/**
 * Resolución temporal de los cortes de avance. Un paquete acumula muchos
 * cortes; a una fecha dada, el "vigente" es el último corte con fecha ≤ esa
 * fecha. Esto permite mirar el proyecto a cualquier fecha de corte histórica.
 */

import {
  actualCost,
  earnedValue,
  plannedValue,
  sCurve,
} from '../core/evm';
import type { ProgressEntry, WorkPackage } from '../core/types';

/** Corte vigente por paquete a una fecha: el más reciente con fecha ≤ dataDate. */
export function vigenteByWp(
  entries: readonly ProgressEntry[],
  dataDate: string
): Map<string, ProgressEntry> {
  const cut = Date.parse(dataDate);
  const out = new Map<string, ProgressEntry>();
  for (const e of entries) {
    if (Date.parse(e.fechaCorte) > cut) continue;
    const prev = out.get(e.workPackageId);
    if (!prev || Date.parse(e.fechaCorte) > Date.parse(prev.fechaCorte)) {
      out.set(e.workPackageId, e);
    }
  }
  return out;
}

/** Fechas de corte distintas con fecha ≤ dataDate, ordenadas ascendente. */
export function cutDatesUpTo(entries: readonly ProgressEntry[], dataDate: string): string[] {
  const cut = Date.parse(dataDate);
  const set = new Set<string>();
  for (const e of entries) {
    if (Date.parse(e.fechaCorte) <= cut) set.add(e.fechaCorte);
  }
  return [...set].sort();
}

/** Todas las fechas de corte distintas del conjunto, ordenadas ascendente. */
export function allCutDates(entries: readonly ProgressEntry[]): string[] {
  return [...new Set(entries.map((e) => e.fechaCorte))].sort();
}

export interface CurvePoint {
  date: string;
  pv: number;
  ev: number;
  ac: number;
}

/**
 * Serie temporal de PV/EV/AC del proyecto a lo largo de las fechas de corte
 * indicadas. Para cada fecha usa el corte vigente de cada paquete.
 */
export function evmHistory(
  workPackages: readonly WorkPackage[],
  entries: readonly ProgressEntry[],
  dates: readonly string[]
): CurvePoint[] {
  return dates.map((date) => {
    const vig = vigenteByWp(entries, date);
    return {
      date,
      pv: plannedValue(workPackages, date, sCurve),
      ev: earnedValue(workPackages, vig),
      ac: actualCost(workPackages, vig),
    };
  });
}
