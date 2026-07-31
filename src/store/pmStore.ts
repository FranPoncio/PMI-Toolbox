import { create } from 'zustand';
import type {
  AuditAction,
  AuditEntity,
  AuditEntry,
  Baseline,
  ProgressEntry,
  Project,
  User,
  WorkPackage,
} from '../core/types';
import { buildBaselineSnapshot } from '../analytics/baseline';
import { allCutDates } from '../analytics/resolve';
import { subtreeIds } from '../analytics/wbs';
import { newId } from '../db/db';
import { seedIfEmpty, seedUsersIfEmpty } from '../db/seed';
import * as repo from '../db/repository';

const CURRENT_USER_KEY = 'pmi-toolbox.currentUserId';

interface PmState {
  status: 'idle' | 'loading' | 'ready';
  projects: Project[];
  selectedProjectId: string | null;
  workPackages: WorkPackage[];
  progressEntries: ProgressEntry[];
  baselines: Baseline[];
  /** Bitácora del proyecto seleccionado (más reciente primero). */
  auditLog: AuditEntry[];
  /** Usuarios disponibles y la sesión actual. */
  users: User[];
  currentUserId: string | null;
  /** Fecha de corte con la que se mira el proyecto. */
  dataDate: string | null;

  init: () => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  setDataDate: (date: string) => void;
  setCurrentUser: (id: string) => void;

  saveProject: (data: Omit<Project, 'id'> & { id?: string }) => Promise<string>;
  removeProject: (id: string) => Promise<void>;

  saveWorkPackage: (data: Omit<WorkPackage, 'id'> & { id?: string }) => Promise<void>;
  removeWorkPackage: (id: string) => Promise<void>;
  importWorkPackages: (drafts: Omit<WorkPackage, 'id' | 'projectId'>[]) => Promise<void>;

  saveProgress: (data: Omit<ProgressEntry, 'id'> & { id?: string }) => Promise<void>;
  removeProgress: (id: string) => Promise<void>;
  importProgress: (drafts: Omit<ProgressEntry, 'id'>[], fuente?: 'manual' | 'csv') => Promise<void>;

  freezeBaseline: (fechaAprobacion: string, motivo: string) => Promise<void>;
  removeBaseline: (id: string) => Promise<void>;
}

function defaultDataDate(project: Project | undefined, entries: ProgressEntry[]): string | null {
  if (!project) return null;
  const cuts = allCutDates(entries);
  return cuts.length ? cuts[cuts.length - 1]! : project.fechaInicio;
}

function readStoredUser(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(CURRENT_USER_KEY) : null;
  } catch {
    return null;
  }
}

export const usePmStore = create<PmState>((set, get) => {
  async function loadProjectData(projectId: string, keepDate = false) {
    const [workPackages, progressEntries, baselines, auditLog] = await Promise.all([
      repo.listWorkPackages(projectId),
      repo.listProgressForProject(projectId),
      repo.listBaselines(projectId),
      repo.listAudit(projectId),
    ]);
    const project = get().projects.find((p) => p.id === projectId);
    const dataDate = keepDate
      ? (get().dataDate ?? defaultDataDate(project, progressEntries))
      : defaultDataDate(project, progressEntries);
    set({ workPackages, progressEntries, baselines, auditLog, dataDate });
  }

  /** Registra una entrada de bitácora con el usuario de la sesión actual. */
  async function record(
    projectId: string,
    action: AuditAction,
    entity: AuditEntity,
    resumen: string
  ) {
    const user = get().users.find((u) => u.id === get().currentUserId);
    if (!user) return;
    const entry: AuditEntry = {
      id: newId(),
      ts: new Date().toISOString(),
      projectId,
      userId: user.id,
      userNombre: user.nombre,
      userRol: user.rol,
      action,
      entity,
      resumen,
    };
    await repo.appendAudit(entry);
    if (get().selectedProjectId === projectId) {
      set({ auditLog: await repo.listAudit(projectId) });
    }
  }

  return {
    status: 'idle',
    projects: [],
    selectedProjectId: null,
    workPackages: [],
    progressEntries: [],
    baselines: [],
    auditLog: [],
    users: [],
    currentUserId: null,
    dataDate: null,

    async init() {
      if (get().status !== 'idle') return; // idempotente (StrictMode)
      set({ status: 'loading' });
      const users = await seedUsersIfEmpty();
      await seedIfEmpty();
      const stored = readStoredUser();
      const currentUserId = users.find((u) => u.id === stored)?.id ?? users[0]?.id ?? null;
      const projects = await repo.listProjects();
      set({ users, currentUserId, projects });
      const first = projects[0]?.id ?? null;
      if (first) {
        set({ selectedProjectId: first });
        await loadProjectData(first);
      }
      set({ status: 'ready' });
    },

    async selectProject(id) {
      set({ selectedProjectId: id, dataDate: null });
      await loadProjectData(id);
    },

    setDataDate(date) {
      set({ dataDate: date });
    },

    setCurrentUser(id) {
      set({ currentUserId: id });
      try {
        localStorage?.setItem(CURRENT_USER_KEY, id);
      } catch {
        /* sin persistencia si no hay localStorage */
      }
    },

    async saveProject(data) {
      const id = data.id ?? newId();
      const project: Project = { ...data, id };
      await repo.putProject(project);
      const projects = await repo.listProjects();
      set({ projects });
      if (!data.id) {
        set({ selectedProjectId: id, dataDate: null });
        await loadProjectData(id);
        await record(id, 'crear', 'proyecto', `Creó el proyecto «${project.nombre}»`);
      } else {
        await record(id, 'editar', 'proyecto', `Editó el proyecto «${project.nombre}»`);
      }
      return id;
    },

    async removeProject(id) {
      const nombre = get().projects.find((p) => p.id === id)?.nombre ?? id;
      await record(id, 'borrar', 'proyecto', `Borró el proyecto «${nombre}»`);
      await repo.deleteProject(id);
      const projects = await repo.listProjects();
      set({ projects });
      if (get().selectedProjectId === id) {
        const next = projects[0]?.id ?? null;
        set({
          selectedProjectId: next,
          workPackages: [],
          progressEntries: [],
          baselines: [],
          auditLog: [],
          dataDate: null,
        });
        if (next) await loadProjectData(next);
      }
    },

    async saveWorkPackage(data) {
      const id = data.id ?? newId();
      await repo.putWorkPackage({ ...data, id });
      const pid = get().selectedProjectId;
      if (pid) {
        await loadProjectData(pid, true);
        await record(
          pid,
          data.id ? 'editar' : 'crear',
          'paquete',
          `${data.id ? 'Editó' : 'Creó'} el paquete «${data.nombre}»`
        );
      }
    },

    async removeWorkPackage(id) {
      const ids = subtreeIds(id, get().workPackages);
      const nombre = get().workPackages.find((w) => w.id === id)?.nombre ?? id;
      for (const wid of ids) await repo.deleteWorkPackage(wid);
      const pid = get().selectedProjectId;
      if (pid) {
        await loadProjectData(pid, true);
        const extra = ids.length > 1 ? ` y ${ids.length - 1} sub-paquete(s)` : '';
        await record(pid, 'borrar', 'paquete', `Borró el paquete «${nombre}»${extra}`);
      }
    },

    async importWorkPackages(drafts) {
      const pid = get().selectedProjectId;
      if (!pid || drafts.length === 0) return;
      const wps: WorkPackage[] = drafts.map((d) => ({ ...d, id: newId(), projectId: pid }));
      await repo.bulkPutWorkPackages(wps);
      await loadProjectData(pid, true);
      await record(pid, 'importar', 'paquete', `Importó ${wps.length} paquete(s) por CSV`);
    },

    async saveProgress(data) {
      const id = data.id ?? newId();
      await repo.putProgressEntry({ ...data, id });
      const pid = get().selectedProjectId;
      if (pid) await loadProjectData(pid, true);
    },

    async removeProgress(id) {
      await repo.deleteProgressEntry(id);
      const pid = get().selectedProjectId;
      if (pid) await loadProjectData(pid, true);
    },

    async importProgress(drafts, fuente = 'csv') {
      const pid = get().selectedProjectId;
      if (!pid || drafts.length === 0) return;
      const existentes = get().progressEntries;
      const entries: ProgressEntry[] = drafts.map((d) => {
        const prev = existentes.find(
          (p) => p.workPackageId === d.workPackageId && p.fechaCorte === d.fechaCorte
        );
        return { ...d, id: prev?.id ?? newId() };
      });
      await repo.bulkPutProgress(entries);
      await loadProjectData(pid, true);

      const fechas = [...new Set(entries.map((e) => e.fechaCorte))];
      const resumen =
        fuente === 'manual'
          ? `Cargó el corte ${fechas[0]} (${entries.length} paquete(s))`
          : `Importó ${entries.length} avance(s) en ${fechas.length} corte(s) por CSV`;
      await record(pid, 'importar', 'corte', resumen);
    },

    async freezeBaseline(fechaAprobacion, motivo) {
      const pid = get().selectedProjectId;
      const project = get().projects.find((p) => p.id === pid);
      if (!project) return;
      const version = get().baselines.reduce((max, b) => Math.max(max, b.version), 0) + 1;
      const snapshot = buildBaselineSnapshot(
        project,
        get().workPackages,
        version,
        fechaAprobacion,
        motivo
      );
      await repo.freezeBaseline({ ...snapshot, id: newId() });
      await loadProjectData(project.id, true);
      await record(project.id, 'congelar', 'linea_base', `Congeló la línea base v${version}`);
    },

    async removeBaseline(id) {
      const pid = get().selectedProjectId;
      const version = get().baselines.find((b) => b.id === id)?.version;
      await repo.deleteBaseline(id);
      if (pid) {
        await loadProjectData(pid, true);
        await record(pid, 'borrar', 'linea_base', `Borró la línea base v${version ?? '?'}`);
      }
    },
  };
});
