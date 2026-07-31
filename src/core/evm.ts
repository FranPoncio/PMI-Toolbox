/**
 * Motor de Earned Value Management (EVM).
 *
 * Funciones puras, sin React, sin estado, sin I/O. Toda la matemática de EVM
 * de PMTool vive acá y es la única fuente de verdad de los indicadores.
 *
 * Regla de división por cero: cuando un indicador resulta de dividir por algo
 * que puede valer 0 (típicamente al arranque del proyecto, cuando PV/AC/EV son
 * 0), se devuelve `null` en vez de `Infinity`/`NaN`. `null` = "indefinido /
 * sin información suficiente todavía", que es semánticamente distinto de un
 * número. Los consumidores deciden cómo mostrarlo (ej.: "—").
 */

import type {
  EacMethod,
  EvmInputs,
  EvmResult,
  ProgressEntry,
  WorkPackage,
} from './types';

// ────────────────────────────────────────────────────────────────────────────
// Utilidad interna
// ────────────────────────────────────────────────────────────────────────────

/** División segura: `null` si el denominador es exactamente 0. */
function safeDiv(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

// ────────────────────────────────────────────────────────────────────────────
// Nivel 1 — Métricas primitivas (números → número | null)
// Coinciden 1:1 con las fórmulas de libro de texto para que sean triviales de
// testear y auditar.
// ────────────────────────────────────────────────────────────────────────────

/** Schedule Variance = EV − PV. >0 adelantado, <0 atrasado. */
export function scheduleVariance(ev: number, pv: number): number {
  return ev - pv;
}

/** Cost Variance = EV − AC. >0 bajo presupuesto, <0 sobrecosto. */
export function costVariance(ev: number, ac: number): number {
  return ev - ac;
}

/** Schedule Performance Index = EV / PV. `null` si PV = 0. */
export function schedulePerformanceIndex(ev: number, pv: number): number | null {
  return safeDiv(ev, pv);
}

/** Cost Performance Index = EV / AC. `null` si AC = 0. */
export function costPerformanceIndex(ev: number, ac: number): number | null {
  return safeDiv(ev, ac);
}

/**
 * Estimate At Completion según el método elegido.
 *
 *  - `cpi`        → BAC / CPI
 *  - `budgetRate` → AC + (BAC − EV)
 *  - `cpiSpi`     → AC + (BAC − EV) / (CPI × SPI)
 *
 * Devuelve `null` cuando el método requiere un índice indefinido (CPI/SPI = null)
 * o cuando el denominador combinado (CPI × SPI) es 0.
 */
export function estimateAtCompletion(
  inputs: EvmInputs,
  method: EacMethod
): number | null {
  const { pv, ev, ac, bac } = inputs;

  switch (method) {
    case 'budgetRate':
      // Trabajo restante al presupuesto original. Siempre definido.
      return ac + (bac - ev);

    case 'cpi': {
      const cpi = costPerformanceIndex(ev, ac);
      if (cpi === null) return null;
      return safeDiv(bac, cpi);
    }

    case 'cpiSpi': {
      const cpi = costPerformanceIndex(ev, ac);
      const spi = schedulePerformanceIndex(ev, pv);
      if (cpi === null || spi === null) return null;
      const factor = cpi * spi;
      const remaining = safeDiv(bac - ev, factor);
      if (remaining === null) return null;
      return ac + remaining;
    }
  }
}

/** Estimate To Complete = EAC − AC. `null` si EAC es `null`. */
export function estimateToComplete(eac: number | null, ac: number): number | null {
  if (eac === null) return null;
  return eac - ac;
}

/** Variance At Completion = BAC − EAC. `null` si EAC es `null`. */
export function varianceAtCompletion(bac: number, eac: number | null): number | null {
  if (eac === null) return null;
  return bac - eac;
}

/**
 * To-Complete Performance Index contra BAC = (BAC − EV) / (BAC − AC).
 * Eficiencia de costo necesaria en lo que resta para terminar dentro del BAC.
 * `null` si BAC − AC = 0 (no queda "presupuesto restante" contra el cual medir).
 */
export function tcpiToBac(ev: number, ac: number, bac: number): number | null {
  return safeDiv(bac - ev, bac - ac);
}

/**
 * To-Complete Performance Index contra un EAC = (BAC − EV) / (EAC − AC).
 * `null` si EAC es `null` o si EAC − AC = 0.
 */
export function tcpiToEac(
  ev: number,
  ac: number,
  bac: number,
  eac: number | null
): number | null {
  if (eac === null) return null;
  return safeDiv(bac - ev, eac - ac);
}

// ────────────────────────────────────────────────────────────────────────────
// Nivel 2 — Derivación de las curvas desde el modelo de datos
// PV/EV/AC no son insumos mágicos: se derivan de los paquetes de trabajo y de
// los reportes de avance a una fecha de corte.
// ────────────────────────────────────────────────────────────────────────────

/** Suma de presupuestos de un conjunto de paquetes (= BAC del subconjunto). */
export function budgetAtCompletion(workPackages: readonly WorkPackage[]): number {
  return workPackages.reduce((acc, wp) => acc + wp.presupuesto, 0);
}

/**
 * Curva de avance planificado: mapea el tiempo transcurrido normalizado
 * `t ∈ [0,1]` a la fracción de presupuesto que debería estar devengada.
 * Debe cumplir `curve(0) = 0`, `curve(1) = 1` y ser monótona creciente.
 */
export type ProgressCurve = (t: number) => number;

/** Curva lineal: el presupuesto se devenga a ritmo constante. */
export const linearCurve: ProgressCurve = (t) => t;

/**
 * Curva S (smoothstep de Hermite: `3t² − 2t³`). Arranque lento, aceleración en
 * el medio y desaceleración al final — el perfil típico de una obra o proyecto
 * real. Es simétrica, con pendiente nula en ambos extremos y `curve(0.5) = 0.5`.
 * Es la curva por defecto de PMTool para el time-phasing del PV.
 */
export const sCurve: ProgressCurve = (t) => t * t * (3 - 2 * t);

/**
 * Fracción de valor planificado de un paquete a una fecha de corte.
 * El tiempo entre inicio y fin planificados se normaliza a `t ∈ [0,1]` y se
 * pasa por `curve` (curva S por defecto):
 *  - 0 si la fecha de corte es anterior (o igual) al inicio planificado.
 *  - 1 si es posterior (o igual) al fin planificado.
 *  - `curve(t)` en el medio.
 *
 * Si inicio y fin coinciden (paquete "hito", duración cero), la fracción es 0
 * antes de esa fecha y 1 desde esa fecha en adelante.
 */
export function plannedFraction(
  wp: WorkPackage,
  dataDate: string,
  curve: ProgressCurve = sCurve
): number {
  const start = Date.parse(wp.fechaInicioPlan);
  const end = Date.parse(wp.fechaFinPlan);
  const now = Date.parse(dataDate);

  if (now <= start) return 0;
  if (now >= end) return 1;
  if (end === start) return now >= end ? 1 : 0;
  const t = (now - start) / (end - start);
  return curve(t);
}

/**
 * Planned Value (BCWS) del conjunto a una fecha de corte:
 * Σ presupuesto_wp × fracciónPlanificada(wp, fecha, curve).
 */
export function plannedValue(
  workPackages: readonly WorkPackage[],
  dataDate: string,
  curve: ProgressCurve = sCurve
): number {
  return workPackages.reduce(
    (acc, wp) => acc + wp.presupuesto * plannedFraction(wp, dataDate, curve),
    0
  );
}

/**
 * Earned Value (BCWP) del conjunto: Σ presupuesto_wp × avanceFísico_wp.
 * `progressByWp` mapea id de paquete → su reporte de avance vigente a la fecha
 * de corte. Los paquetes sin reporte cuentan con avance 0.
 */
export function earnedValue(
  workPackages: readonly WorkPackage[],
  progressByWp: ReadonlyMap<string, ProgressEntry>
): number {
  return workPackages.reduce((acc, wp) => {
    const entry = progressByWp.get(wp.id);
    const avance = entry ? entry.avanceFisico : 0;
    return acc + wp.presupuesto * avance;
  }, 0);
}

/**
 * Actual Cost (ACWP) del conjunto: Σ costoRealAcum_wp.
 * Los paquetes sin reporte cuentan con costo 0.
 */
export function actualCost(
  workPackages: readonly WorkPackage[],
  progressByWp: ReadonlyMap<string, ProgressEntry>
): number {
  return workPackages.reduce((acc, wp) => {
    const entry = progressByWp.get(wp.id);
    return acc + (entry ? entry.costoRealAcum : 0);
  }, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// Nivel 3 — Agregador
// ────────────────────────────────────────────────────────────────────────────

const EAC_METHODS: readonly EacMethod[] = ['cpi', 'budgetRate', 'cpiSpi'];

export interface ComputeEvmOptions {
  /**
   * Método de EAC usado para `tcpiEac`. Por defecto `cpi`, que es el más
   * conservador cuando el desvío de costo es sistémico.
   */
  tcpiEacMethod?: EacMethod;
}

/**
 * Calcula el resultado EVM completo a partir de las tres curvas + BAC.
 * Esta es la función que consume la interfaz.
 */
export function computeEvm(inputs: EvmInputs, options: ComputeEvmOptions = {}): EvmResult {
  const { pv, ev, ac, bac } = inputs;
  const tcpiEacMethod = options.tcpiEacMethod ?? 'cpi';

  const eac = {} as Record<EacMethod, number | null>;
  const etc = {} as Record<EacMethod, number | null>;
  const vac = {} as Record<EacMethod, number | null>;

  for (const method of EAC_METHODS) {
    const value = estimateAtCompletion(inputs, method);
    eac[method] = value;
    etc[method] = estimateToComplete(value, ac);
    vac[method] = varianceAtCompletion(bac, value);
  }

  return {
    pv,
    ev,
    ac,
    bac,
    sv: scheduleVariance(ev, pv),
    cv: costVariance(ev, ac),
    spi: schedulePerformanceIndex(ev, pv),
    cpi: costPerformanceIndex(ev, ac),
    eac,
    etc,
    vac,
    tcpiBac: tcpiToBac(ev, ac, bac),
    tcpiEac: tcpiToEac(ev, ac, bac, eac[tcpiEacMethod]),
  };
}
