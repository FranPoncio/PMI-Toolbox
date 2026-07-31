/**
 * Pronóstico de plazo por Earned Schedule: convierte el avance ganado en una
 * fecha de finalización pronosticada, comparable contra el fin planificado.
 * Es lógica pura sobre el motor de `core/`.
 */

import {
  earnedScheduleFraction,
  independentEacTime,
  scheduleVarianceTime,
  spiTime,
} from '../core/earnedSchedule';
import { plannedValue, sCurve } from '../core/evm';
import type { IsoDate, PlannedItem, Project } from '../core/types';

const DAY = 86_400_000;
const MONTH_DAYS = 30.436875; // días promedio por mes

function isoAtFraction(startIso: string, endIso: string, t: number): string {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  return new Date(start + t * (end - start)).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): IsoDate {
  return new Date(Date.parse(iso) + days * DAY).toISOString().slice(0, 10);
}

export interface ScheduleForecast {
  /** Planned Duration: duración planificada, en meses. */
  pdMonths: number;
  /** Actual Time: tiempo transcurrido a la fecha de corte, en meses. */
  atMonths: number;
  /** Earned Schedule, en meses desde el inicio. */
  esMonths: number;
  /** SV(t) = ES − AT, en meses. Negativo = atrasado. */
  svtMonths: number;
  /** SPI(t) = ES / AT. `null` si AT = 0. */
  spit: number | null;
  /** Duración estimada a fin (IEAC-t) = PD / SPI(t), en meses. */
  ieacMonths: number | null;
  fechaFinPlan: IsoDate;
  /** Fecha de fin pronosticada al ritmo actual. `null` si no computable. */
  fechaFinPronosticada: IsoDate | null;
  /** Atraso pronosticado a fin, en meses (IEAC-t − PD). Positivo = atraso. */
  atrasoMeses: number | null;
}

/**
 * Calcula el pronóstico de plazo del proyecto a una fecha de corte, usando la
 * curva S de PV como referencia temporal y el EV consolidado (`evNow`).
 * `planItems` y `bac` son los de referencia (línea base activa si hay).
 */
export function scheduleForecast(
  project: Project,
  planItems: readonly PlannedItem[],
  bac: number,
  evNow: number,
  dataDate: string
): ScheduleForecast {
  const start = project.fechaInicio;
  const end = project.fechaFinPlan;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);

  const pdDays = Math.max(0, (endMs - startMs) / DAY);
  const atDays = Math.max(0, (Date.parse(dataDate) - startMs) / DAY);

  const pvAt = (t: number) => plannedValue(planItems, isoAtFraction(start, end, t), sCurve);
  const esFrac = earnedScheduleFraction(pvAt, evNow, bac);
  const esDays = esFrac * pdDays;

  const pdMonths = pdDays / MONTH_DAYS;
  const atMonths = atDays / MONTH_DAYS;
  const esMonths = esDays / MONTH_DAYS;

  const spit = spiTime(esMonths, atMonths);
  const ieacMonths = independentEacTime(pdMonths, spit);

  const fechaFinPronosticada = ieacMonths === null ? null : addDays(start, ieacMonths * MONTH_DAYS);
  const atrasoMeses = ieacMonths === null ? null : ieacMonths - pdMonths;

  return {
    pdMonths,
    atMonths,
    esMonths,
    svtMonths: scheduleVarianceTime(esMonths, atMonths),
    spit,
    ieacMonths,
    fechaFinPlan: end,
    fechaFinPronosticada,
    atrasoMeses,
  };
}
