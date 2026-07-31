/**
 * Seed inicial: si la base está vacía, carga el proyecto de ejemplo con una
 * historia de cortes (no una sola foto), para que la curva S muestre la
 * evolución real de EV y AC en el tiempo.
 */

import type { ProgressEntry } from '../core/types';
import {
  DATA_DATE,
  finalProgress,
  project,
  workPackages,
} from '../fixtures/gasoducto';
import { bulkInsert, countProjects } from './repository';

/** Fechas de corte del ejemplo (mensuales) hasta la fecha de corte final. */
const CUT_DATES = [
  '2026-02-28',
  '2026-03-31',
  '2026-04-30',
  '2026-05-31',
  '2026-06-30',
  DATA_DATE,
];

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Genera los cortes de un paquete rampeando avance y costo hacia sus valores
 * finales. El costo acompaña proporcionalmente al avance, así el CPI se
 * mantiene coherente entre cortes.
 */
function buildHistory(): ProgressEntry[] {
  const finalByWp = new Map(finalProgress.map((p) => [p.wpId, p]));
  const finalMs = Date.parse(DATA_DATE);
  const entries: ProgressEntry[] = [];

  for (const wp of workPackages) {
    const target = finalByWp.get(wp.id);
    if (!target || target.avanceFisico === 0) continue; // aún no arrancó

    const startMs = Date.parse(wp.fechaInicioPlan);
    for (const date of CUT_DATES) {
      const d = Date.parse(date);
      if (d < startMs) continue; // el paquete no había arrancado en esa fecha
      const ramp = clamp01((d - startMs) / (finalMs - startMs || 1));
      entries.push({
        id: `${wp.id}-${date}`,
        workPackageId: wp.id,
        fechaCorte: date,
        avanceFisico: Number((target.avanceFisico * ramp).toFixed(4)),
        costoRealAcum: Math.round(target.costoRealAcum * ramp),
      });
    }
  }
  return entries;
}

/** Carga el ejemplo sólo si no hay proyectos. Devuelve true si sembró. */
export async function seedIfEmpty(): Promise<boolean> {
  if ((await countProjects()) > 0) return false;
  await bulkInsert([project], [...workPackages], buildHistory());
  return true;
}
