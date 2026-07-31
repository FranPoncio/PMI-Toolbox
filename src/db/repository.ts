/**
 * Repositorio: única puerta de acceso a la base. La UI y el store no tocan
 * Dexie directamente, hablan con estas funciones. Devuelven Promises.
 */

import type { ProgressEntry, Project, WorkPackage } from '../core/types';
import { db } from './db';

// ── Proyectos ───────────────────────────────────────────────────────────────

export function listProjects(): Promise<Project[]> {
  return db.projects.orderBy('nombre').toArray();
}

export function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function putProject(project: Project): Promise<void> {
  await db.projects.put(project);
}

/** Borra un proyecto y todo lo colgado de él (paquetes y cortes). */
export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.workPackages, db.progressEntries, async () => {
    const wps = await db.workPackages.where('projectId').equals(id).toArray();
    const wpIds = wps.map((w) => w.id);
    await db.progressEntries.where('workPackageId').anyOf(wpIds).delete();
    await db.workPackages.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

// ── Paquetes de trabajo ───────────────────────────────────────────────────────

export function listWorkPackages(projectId: string): Promise<WorkPackage[]> {
  return db.workPackages.where('projectId').equals(projectId).toArray();
}

export async function putWorkPackage(wp: WorkPackage): Promise<void> {
  await db.workPackages.put(wp);
}

/** Borra un paquete y sus cortes de avance. */
export async function deleteWorkPackage(id: string): Promise<void> {
  await db.transaction('rw', db.workPackages, db.progressEntries, async () => {
    await db.progressEntries.where('workPackageId').equals(id).delete();
    await db.workPackages.delete(id);
  });
}

// ── Cortes de avance ──────────────────────────────────────────────────────────

/** Todos los cortes de los paquetes de un proyecto. */
export async function listProgressForProject(projectId: string): Promise<ProgressEntry[]> {
  const wps = await db.workPackages.where('projectId').equals(projectId).toArray();
  const wpIds = wps.map((w) => w.id);
  if (wpIds.length === 0) return [];
  return db.progressEntries.where('workPackageId').anyOf(wpIds).toArray();
}

export async function putProgressEntry(entry: ProgressEntry): Promise<void> {
  await db.progressEntries.put(entry);
}

export async function deleteProgressEntry(id: string): Promise<void> {
  await db.progressEntries.delete(id);
}

// ── Utilidades ────────────────────────────────────────────────────────────────

export function countProjects(): Promise<number> {
  return db.projects.count();
}

/** Reemplaza en bloque todo el contenido (usado por el seed inicial). */
export async function bulkInsert(
  projects: Project[],
  workPackages: WorkPackage[],
  progressEntries: ProgressEntry[]
): Promise<void> {
  await db.transaction('rw', db.projects, db.workPackages, db.progressEntries, async () => {
    await db.projects.bulkPut(projects);
    await db.workPackages.bulkPut(workPackages);
    await db.progressEntries.bulkPut(progressEntries);
  });
}
