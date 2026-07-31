import Dexie, { type Table } from 'dexie';
import type { Baseline, ProgressEntry, Project, WorkPackage } from '../core/types';

/**
 * Base de datos local de PMI Toolbox sobre IndexedDB (Dexie).
 *
 * Índices declarados: sólo los que se usan para consultar. El resto de los
 * campos viaja en el objeto pero no se indexa.
 *  - workPackages por `projectId` (traer los paquetes de un proyecto).
 *  - progressEntries por `workPackageId` y por `[workPackageId+fechaCorte]`.
 *  - baselines por `projectId` (traer las líneas base de un proyecto).
 *
 * v2 agrega la tabla `baselines` (línea base congelada).
 */
export class PmToolDB extends Dexie {
  projects!: Table<Project, string>;
  workPackages!: Table<WorkPackage, string>;
  progressEntries!: Table<ProgressEntry, string>;
  baselines!: Table<Baseline, string>;

  constructor() {
    super('pmtool');
    this.version(1).stores({
      projects: 'id, nombre, tipo',
      workPackages: 'id, projectId',
      progressEntries: 'id, workPackageId, fechaCorte, [workPackageId+fechaCorte]',
    });
    this.version(2).stores({
      baselines: 'id, projectId, [projectId+version]',
    });
  }
}

export const db = new PmToolDB();

/** Genera un id único. Usa crypto.randomUUID si está disponible. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
