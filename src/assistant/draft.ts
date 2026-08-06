/**
 * Conversión de un `ProjectDraft` (lo que produce el asistente) a las entidades
 * del modelo: un Project y su WBS de WorkPackage[]. Pura y testeable. Resuelve
 * la jerarquía por nombre de padre (el asistente no conoce ids).
 */

import type { Project, WorkPackage } from '../core/types';
import type { ProjectDraft } from './types';

export interface DraftEntities {
  project: Project;
  workPackages: WorkPackage[];
}

/**
 * Construye Project + WorkPackage[] a partir del borrador. `newId` inyecta el
 * generador de ids (para poder testear con ids determinísticos).
 */
export function draftToEntities(draft: ProjectDraft, newId: () => string): DraftEntities {
  const projectId = newId();

  const project: Project = {
    id: projectId,
    nombre: draft.nombre,
    tipo: draft.tipo,
    bac: draft.bac,
    fechaInicio: draft.fechaInicio,
    fechaFinPlan: draft.fechaFinPlan,
    moneda: draft.moneda,
    riesgos: draft.riesgos || undefined,
    proximosPasos: draft.proximosPasos || undefined,
  };

  // Primera pasada: crear todos los paquetes con id, mapeando nombre → id para
  // resolver la jerarquía después. Si hay nombres repetidos, gana el primero.
  const idByNombre = new Map<string, string>();
  const conId = draft.paquetes.map((p) => {
    const id = newId();
    if (!idByNombre.has(p.nombre)) idByNombre.set(p.nombre, id);
    return { id, draft: p };
  });

  const workPackages: WorkPackage[] = conId.map(({ id, draft: p }) => ({
    id,
    projectId,
    parentId: p.parentNombre ? idByNombre.get(p.parentNombre) ?? null : null,
    nombre: p.nombre,
    presupuesto: p.presupuesto,
    peso: p.peso,
    fechaInicioPlan: p.fechaInicioPlan,
    fechaFinPlan: p.fechaFinPlan,
    responsable: p.responsable,
  }));

  return { project, workPackages };
}
