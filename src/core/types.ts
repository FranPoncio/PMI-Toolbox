/**
 * Modelo de datos de PMTool y tipos del motor EVM.
 *
 * Convención de este módulo:
 *  - Los importes están en la moneda del proyecto (no se mezclan monedas acá).
 *  - Las fechas se guardan como ISO `YYYY-MM-DD` (string), sin hora ni zona,
 *    porque una fecha de corte es un día calendario, no un instante.
 */

/** Tipo de proyecto. Habilita presets de configuración por dominio. */
export type ProjectType = 'obra_civil' | 'industrial' | 'ti' | 'servicios';

/** Código ISO 4217 (ej.: 'ARS', 'USD', 'EUR'). No se valida acá. */
export type CurrencyCode = string;

/** Fecha calendario en formato ISO `YYYY-MM-DD`. */
export type IsoDate = string;

export interface Project {
  id: string;
  nombre: string;
  tipo: ProjectType;
  /** Budget At Completion: presupuesto total autorizado del proyecto. */
  bac: number;
  fechaInicio: IsoDate;
  /** Fecha de fin planificada (baseline). */
  fechaFinPlan: IsoDate;
  moneda: CurrencyCode;
}

export interface WorkPackage {
  id: string;
  projectId: string;
  nombre: string;
  /** Presupuesto del paquete (parte del BAC del proyecto). */
  presupuesto: number;
  /**
   * Peso relativo del paquete dentro del proyecto.
   * Se usa para ponderar el avance físico. Puede expresarse en 0..1 o en
   * puntos arbitrarios; lo que importa es su proporción sobre la suma total.
   */
  peso: number;
  /** Inicio planificado del paquete (baseline). */
  fechaInicioPlan: IsoDate;
  /** Fin planificado del paquete (baseline). */
  fechaFinPlan: IsoDate;
  responsable: string;
}

export interface ProgressEntry {
  id: string;
  workPackageId: string;
  /** Fecha de corte del reporte de avance (data date). */
  fechaCorte: IsoDate;
  /** Avance físico del paquete a la fecha de corte, en 0..1. */
  avanceFisico: number;
  /** Costo real acumulado (ACWP) del paquete a la fecha de corte. */
  costoRealAcum: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Motor EVM
// ────────────────────────────────────────────────────────────────────────────

/**
 * Insumos primarios del cálculo EVM a una fecha de corte.
 * Son las tres curvas clásicas más el presupuesto total.
 */
export interface EvmInputs {
  /** Planned Value (BCWS): valor del trabajo planificado a la fecha de corte. */
  pv: number;
  /** Earned Value (BCWP): valor del trabajo efectivamente ejecutado. */
  ev: number;
  /** Actual Cost (ACWP): costo real incurrido. */
  ac: number;
  /** Budget At Completion: presupuesto total del proyecto. */
  bac: number;
}

/**
 * Método de cálculo del EAC (Estimate At Completion). Tres variantes clásicas:
 *  - `cpi`      → EAC = BAC / CPI. Asume que la eficiencia de costo observada
 *                 se mantiene hasta el final (desvío típico / sistémico).
 *  - `budgetRate` → EAC = AC + (BAC − EV). Asume que el trabajo restante se
 *                 ejecutará al presupuesto original (desvío atípico / puntual).
 *  - `cpiSpi`   → EAC = AC + (BAC − EV) / (CPI × SPI). Pondera el trabajo
 *                 restante por eficiencia de costo y de plazo a la vez.
 */
export type EacMethod = 'cpi' | 'budgetRate' | 'cpiSpi';

/**
 * Resultado completo del cálculo EVM.
 *
 * Los indicadores que resultan de una división cuyo denominador puede ser 0
 * (SPI, CPI, TCPI, y los EAC/ETC/VAC derivados) se devuelven como `null`
 * cuando el cálculo es indefinido, en lugar de `Infinity` o `NaN`. `null`
 * significa "no hay información suficiente para este indicador todavía",
 * lo cual es distinto de un valor numérico.
 */
export interface EvmResult {
  // Insumos (eco, para que el resultado sea autocontenido).
  pv: number;
  ev: number;
  ac: number;
  bac: number;

  // Variaciones (absolutas, misma moneda).
  /** Schedule Variance = EV − PV. >0 adelantado, <0 atrasado. */
  sv: number;
  /** Cost Variance = EV − AC. >0 bajo presupuesto, <0 sobrecosto. */
  cv: number;

  // Índices de desempeño (adimensionales). `null` si el denominador es 0.
  /** Schedule Performance Index = EV / PV. */
  spi: number | null;
  /** Cost Performance Index = EV / AC. */
  cpi: number | null;

  // Proyecciones a fin de proyecto.
  /** EAC según cada variante. `null` si la variante es indefinida. */
  eac: Record<EacMethod, number | null>;
  /** Estimate To Complete = EAC − AC, por variante. */
  etc: Record<EacMethod, number | null>;
  /** Variance At Completion = BAC − EAC, por variante. */
  vac: Record<EacMethod, number | null>;

  // Índices "to complete".
  /** TCPI contra BAC = (BAC − EV) / (BAC − AC). `null` si BAC − AC = 0. */
  tcpiBac: number | null;
  /**
   * TCPI contra el EAC elegido = (BAC − EV) / (EAC − AC).
   * `null` si el EAC es `null` o si EAC − AC = 0.
   */
  tcpiEac: number | null;
}
