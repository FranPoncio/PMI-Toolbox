/**
 * Estructura jerárquica de la WBS (Work Breakdown Structure).
 *
 * Regla de oro (igual que Primavera P6 / MS Project): **solo las hojas cargan
 * datos** (presupuesto, fechas, avance, costo). Los nodos con hijos son de
 * "resumen" y su valor es el roll-up de sus hojas — nunca se tipean, así no hay
 * doble conteo. Estas funciones son puras.
 */

import type { WorkPackage } from '../core/types';

/** Hijos directos de un paquete. */
export function childrenOf(id: string, all: readonly WorkPackage[]): WorkPackage[] {
  return all.filter((w) => (w.parentId ?? null) === id);
}

/** ¿Es hoja? (no tiene hijos). */
export function isLeaf(wp: WorkPackage, all: readonly WorkPackage[]): boolean {
  return childrenOf(wp.id, all).length === 0;
}

/** Paquetes raíz (sin padre). */
export function roots(all: readonly WorkPackage[]): WorkPackage[] {
  const ids = new Set(all.map((w) => w.id));
  // Es raíz si no tiene padre, o si su padre no existe (huérfano ⇒ raíz).
  return all.filter((w) => w.parentId == null || !ids.has(w.parentId));
}

/** Solo las hojas — donde vive el dato real. */
export function leaves(all: readonly WorkPackage[]): WorkPackage[] {
  return all.filter((w) => isLeaf(w, all));
}

/** Ids de todos los descendientes de un paquete (hijos, nietos, …). */
export function descendantIds(id: string, all: readonly WorkPackage[]): string[] {
  const out: string[] = [];
  const stack = childrenOf(id, all);
  while (stack.length > 0) {
    const wp = stack.pop()!;
    out.push(wp.id);
    stack.push(...childrenOf(wp.id, all));
  }
  return out;
}

/** El paquete y todos sus descendientes (para borrado en cascada). */
export function subtreeIds(id: string, all: readonly WorkPackage[]): string[] {
  return [id, ...descendantIds(id, all)];
}

/**
 * Candidatos válidos a padre de un paquete: cualquiera menos sí mismo y sus
 * descendientes (evita ciclos). Para un paquete nuevo (`wpId` indefinido), son
 * todos.
 */
export function parentCandidates(
  all: readonly WorkPackage[],
  wpId?: string
): WorkPackage[] {
  if (!wpId) return [...all];
  const excluded = new Set(subtreeIds(wpId, all));
  return all.filter((w) => !excluded.has(w.id));
}
