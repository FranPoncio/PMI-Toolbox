import { create } from 'zustand';
import type { ProgressEntry, Project, WorkPackage } from '../core/types';
import { allCutDates } from '../analytics/resolve';
import { newId } from '../db/db';
import { seedIfEmpty } from '../db/seed';
import * as repo from '../db/repository';

interface PmState {
  status: 'idle' | 'loading' | 'ready';
  projects: Project[];
  selectedProjectId: string | null;
  workPackages: WorkPackage[];
  progressEntries: ProgressEntry[];
  /** Fecha de corte con la que se mira el proyecto. */
  dataDate: string | null;

  init: () => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  setDataDate: (date: string) => void;

  saveProject: (data: Omit<Project, 'id'> & { id?: string }) => Promise<string>;
  removeProject: (id: string) => Promise<void>;

  saveWorkPackage: (data: Omit<WorkPackage, 'id'> & { id?: string }) => Promise<void>;
  removeWorkPackage: (id: string) => Promise<void>;

  saveProgress: (data: Omit<ProgressEntry, 'id'> & { id?: string }) => Promise<void>;
  removeProgress: (id: string) => Promise<void>;
}

/** Fecha de corte por defecto: el último corte cargado, o el inicio del proyecto. */
function defaultDataDate(project: Project | undefined, entries: ProgressEntry[]): string | null {
  if (!project) return null;
  const cuts = allCutDates(entries);
  return cuts.length ? cuts[cuts.length - 1]! : project.fechaInicio;
}

export const usePmStore = create<PmState>((set, get) => {
  /** Recarga los paquetes y cortes del proyecto seleccionado. */
  async function loadProjectData(projectId: string, keepDate = false) {
    const [workPackages, progressEntries] = await Promise.all([
      repo.listWorkPackages(projectId),
      repo.listProgressForProject(projectId),
    ]);
    const project = get().projects.find((p) => p.id === projectId);
    const dataDate = keepDate
      ? (get().dataDate ?? defaultDataDate(project, progressEntries))
      : defaultDataDate(project, progressEntries);
    set({ workPackages, progressEntries, dataDate });
  }

  return {
    status: 'idle',
    projects: [],
    selectedProjectId: null,
    workPackages: [],
    progressEntries: [],
    dataDate: null,

    async init() {
      if (get().status !== 'idle') return; // idempotente (StrictMode)
      set({ status: 'loading' });
      await seedIfEmpty();
      const projects = await repo.listProjects();
      set({ projects });
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

    async saveProject(data) {
      const id = data.id ?? newId();
      const project: Project = { ...data, id };
      await repo.putProject(project);
      const projects = await repo.listProjects();
      set({ projects });
      if (!data.id) {
        // Proyecto nuevo: seleccionarlo.
        set({ selectedProjectId: id, dataDate: null });
        await loadProjectData(id);
      }
      return id;
    },

    async removeProject(id) {
      await repo.deleteProject(id);
      const projects = await repo.listProjects();
      set({ projects });
      if (get().selectedProjectId === id) {
        const next = projects[0]?.id ?? null;
        set({ selectedProjectId: next, workPackages: [], progressEntries: [], dataDate: null });
        if (next) await loadProjectData(next);
      }
    },

    async saveWorkPackage(data) {
      const id = data.id ?? newId();
      await repo.putWorkPackage({ ...data, id });
      const pid = get().selectedProjectId;
      if (pid) await loadProjectData(pid, true);
    },

    async removeWorkPackage(id) {
      await repo.deleteWorkPackage(id);
      const pid = get().selectedProjectId;
      if (pid) await loadProjectData(pid, true);
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
  };
});
