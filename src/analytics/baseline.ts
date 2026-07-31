/**
 * Lógica de línea base (Performance Measurement Baseline). Pura, sin React.
 *
 * La línea base es la foto congelada del plan contra la que se mide el
 * desempeño. Mientras hay una activa, el PV/EV/BAC se calculan contra esa foto
 * y no contra los paquetes vivos: editar un paquete después de congelar no mueve
 * la base. Cambiar el alcance medido exige una nueva versión (rebaselining).
 */

import type { Baseline, BaselineItem, PlannedItem, Project, WorkPackage } from '../core/types';

/** La línea base vigente, o `undefined` si el proyecto no tiene ninguna. */
export function activeBaseline(baselines: readonly Baseline[]): Baseline | undefined {
  return baselines.find((b) => b.activa);
}

/**
 * Ítem de plan efectivo de un paquete: el de la línea base si existe una foto
 * de ese paquete, o el vivo si es alcance nuevo todavía no baselinado.
 */
export function effectivePlanItem(wp: WorkPackage, baseline: Baseline | undefined): PlannedItem {
  const item = baseline?.items.find((i) => i.workPackageId === wp.id);
  if (!item) {
    return {
      presupuesto: wp.presupuesto,
      fechaInicioPlan: wp.fechaInicioPlan,
      fechaFinPlan: wp.fechaFinPlan,
    };
  }
  return {
    presupuesto: item.presupuesto,
    fechaInicioPlan: item.fechaInicioPlan,
    fechaFinPlan: item.fechaFinPlan,
  };
}

/** Presupuesto de referencia de un paquete (línea base si hay, o vivo). */
export function effectivePresupuesto(wp: WorkPackage, baseline: Baseline | undefined): number {
  return baseline?.items.find((i) => i.workPackageId === wp.id)?.presupuesto ?? wp.presupuesto;
}

/**
 * BAC de referencia: el de la línea base activa, o la suma de presupuestos
 * vivos si no hay base.
 */
export function effectiveBac(
  workPackages: readonly WorkPackage[],
  baseline: Baseline | undefined
): number {
  if (baseline) return baseline.bac;
  return workPackages.reduce((acc, wp) => acc + wp.presupuesto, 0);
}

/** Construye la foto de una nueva línea base a partir del estado vivo (sin id). */
export function buildBaselineSnapshot(
  project: Project,
  workPackages: readonly WorkPackage[],
  version: number,
  fechaAprobacion: string,
  motivo: string
): Omit<Baseline, 'id'> {
  const items: BaselineItem[] = workPackages.map((wp) => ({
    workPackageId: wp.id,
    nombre: wp.nombre,
    presupuesto: wp.presupuesto,
    peso: wp.peso,
    fechaInicioPlan: wp.fechaInicioPlan,
    fechaFinPlan: wp.fechaFinPlan,
  }));
  return {
    projectId: project.id,
    version,
    fechaAprobacion,
    motivo,
    bac: items.reduce((acc, it) => acc + it.presupuesto, 0),
    activa: true,
    items,
  };
}

export interface BaselineDivergence {
  /** ¿La estructura viva difiere de la línea base? */
  cambio: boolean;
  /** Paquetes vivos sin ítem en la base (alcance nuevo). */
  agregados: string[];
  /** Ítems de la base cuyo paquete ya no existe (alcance quitado). */
  quitados: string[];
  /** Paquetes cuyo presupuesto o fechas difieren de la base. */
  modificados: string[];
}

/** Detecta diferencias entre la línea base activa y los paquetes vivos. */
export function diffBaseline(
  baseline: Baseline | undefined,
  workPackages: readonly WorkPackage[]
): BaselineDivergence {
  const empty: BaselineDivergence = { cambio: false, agregados: [], quitados: [], modificados: [] };
  if (!baseline) return empty;

  const byId = new Map(baseline.items.map((i) => [i.workPackageId, i]));
  const vivosIds = new Set(workPackages.map((w) => w.id));

  const agregados: string[] = [];
  const modificados: string[] = [];
  for (const wp of workPackages) {
    const item = byId.get(wp.id);
    if (!item) {
      agregados.push(wp.nombre);
      continue;
    }
    if (
      item.presupuesto !== wp.presupuesto ||
      item.fechaInicioPlan !== wp.fechaInicioPlan ||
      item.fechaFinPlan !== wp.fechaFinPlan
    ) {
      modificados.push(wp.nombre);
    }
  }

  const quitados = baseline.items
    .filter((i) => !vivosIds.has(i.workPackageId))
    .map((i) => i.nombre);

  return {
    cambio: agregados.length > 0 || quitados.length > 0 || modificados.length > 0,
    agregados,
    quitados,
    modificados,
  };
}
