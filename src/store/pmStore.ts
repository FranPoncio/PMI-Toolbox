import { create } from 'zustand';
import type { Baseline, ProgressEntry, Project, WorkPackage } from '../core/types';
import { buildBaselineSnapshot } from '../analytics/baseline';
import { allCutDates } from '../analytics/resolve';
import { subtreeIds } from '../analytics/wbs';
import { newId } from '../db/db';
import { seedIfEmpty } from '../db/seed';
import * as repo from '../db/repository';

interface PmState {
  status: 'idle' | 'loading' | 'ready';
  projects: Project[];
  selectedProjectId: string | null;
  workPackages: WorkPackage[];
  progressEntries: ProgressEntry[];
  baselines: Baseline[];
  /** Fecha de corte con la que se mira el proyecto. */
  dataDate: string | null;

  init: () => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  setDataDate: (date: string) => void;

  saveProject: (data: Omit<Project, 'id'> & { id?: string }) => Promise<string>;
  removeProject: (id: string) => Promise<void>;

  saveWorkPackage: (data: Omit<WorkPackage, 'id'> & { id?: string }) => Promise<void>;
  removeWorkPackage: (id: string) => Promise<void>;

  /** Alta en bloque de paquetes desde un import (se les asigna id y projectId). */
  importWorkPackages: (drafts: Omit<WorkPackage, 'id' | 'projectId'>[]) => Promise<void>;

  saveProgress: (data: Omit<ProgressEntry, 'id'> & { id?: string }) => Promise<void>;
  removeProgress: (id: string) => Promise<void>;

  /** Alta/actualización en bloque de cortes desde un import de avances/costos. */
  importProgress: (drafts: Omit<ProgressEntry, 'id'>[]) => Promise<void>;

  /** Congela una nueva línea base (versión siguiente) y la deja activa. */
  freezeBaseline: (fechaAprobacion: string, motivo: string) => Promise<void>;
  removeBaseline: (id: string) => Promise<void>;
}

/** Fecha de corte por defecto: el último corte cargado, o el inicio del proyecto. */
function defaultDataDate(project: Project | undefined, entries: ProgressEntry[]): string | null {
  if (!project) return null;
  const cuts = allCutDates(entries);
  return cuts.length ? cuts[cuts.length - 1]! : project.fechaInicio;
}

export const usePmStore = create<PmState>((set, get) => {
  /** Recarga los paquetes, cortes y líneas base del proyecto seleccionado. */
  async function loadProjectData(projectId: string, keepDate = false) {
    const [workPackages, progressEntries, baselines] = await Promise.all([
      repo.listWorkPackages(projectId),
      repo.listProgressForProject(projectId),
      repo.listBaselines(projectId),
    ]);
    const project = get().projects.find((p) => p.id === projectId);
    const dataDate = keepDate
      ? (get().dataDate ?? defaultDataDate(project, progressEntries))
      : defaultDataDate(project, progressEntries);
    set({ workPackages, progressEntries, baselines, dataDate });
  }

  return {
    status: 'idle',
    projects: [],
    selectedProjectId: null,
    workPackages: [],
    progressEntries: [],
    baselines: [],
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
        set({
          selectedProjectId: next,
          workPackages: [],
          progressEntries: [],
          baselines: [],
          dataDate: null,
        });
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
      // Borrado en cascada: el paquete y todo su subárbol (y sus cortes).
      const ids = subtreeIds(id, get().workPackages);
      for (const wid of ids) await repo.deleteWorkPackage(wid);
      const pid = get().selectedProjectId;
      if (pid) await loadProjectData(pid, true);
    },

    async importWorkPackages(drafts) {
      const pid = get().selectedProjectId;
      if (!pid || drafts.length === 0) return;
      const wps: WorkPackage[] = drafts.map((d) => ({ ...d, id: newId(), projectId: pid }));
      await repo.bulkPutWorkPackages(wps);
      await loadProjectData(pid, true);
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

    async importProgress(drafts) {
      const pid = get().selectedProjectId;
      if (!pid || drafts.length === 0) return;
      const existentes = get().progressEntries;
      const entries: ProgressEntry[] = drafts.map((d) => {
        // Reusa el id si ya existe un corte del mismo paquete y fecha (sobrescribe).
        const prev = existentes.find(
          (p) => p.workPackageId === d.workPackageId && p.fechaCorte === d.fechaCorte
        );
        return { ...d, id: prev?.id ?? newId() };
      });
      await repo.bulkPutProgress(entries);
      await loadProjectData(pid, true);
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
    },

    async removeBaseline(id) {
      await repo.deleteBaseline(id);
      const pid = get().selectedProjectId;
      if (pid) await loadProjectData(pid, true);
    },
  };
});
