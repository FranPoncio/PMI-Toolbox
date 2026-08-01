/**
 * Clasificación de estado a partir de índices de desempeño (SPI/CPI).
 * Los tres estados mapean 1:1 con los colores semánticos de la paleta:
 *   onplan (verde) · atención (ámbar) · desvío (rojo).
 * `sin-dato` es para índices indefinidos (denominador 0 al arranque).
 *
 * Umbrales sensibles a la etapa
 * -----------------------------
 * Un mismo SPI/CPI no pesa igual al 10 % que al 80 % de avance. Al arranque
 * los índices son ruidosos y hay margen para corregir; sobre el final, el mismo
 * desvío es casi irreversible. Por eso la tolerancia se estrecha a medida que
 * el proyecto avanza —el criterio que usan los bancos multilaterales (ISR del
 * Banco Mundial, PMR del BID) al calificar un préstamo según su madurez—.
 */
export type Status = 'onplan' | 'atencion' | 'desvio' | 'sin-dato';

/** Etapa del proyecto según el avance físico (EV/BAC). */
export type Stage = 'inicial' | 'intermedia' | 'final';

/** Umbrales de índice de una etapa: por encima de `atencion` está en plan; */
/** entre `atencion` y `desvio`, atención; por debajo de `desvio`, desvío.   */
export interface StageThreshold {
  atencion: number;
  desvio: number;
}

export type ThresholdConfig = Record<Stage, StageThreshold>;

/**
 * Umbrales por defecto. La etapa intermedia conserva el criterio histórico
 * (0.98 / 0.90); la inicial es más tolerante y la final, más estricta.
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  inicial: { atencion: 0.95, desvio: 0.85 },
  intermedia: { atencion: 0.98, desvio: 0.9 },
  final: { atencion: 0.99, desvio: 0.95 },
};

/** Cortes de etapa por avance físico acumulado (EV/BAC). */
export const STAGE_BOUNDS = { inicial: 0.3, intermedia: 0.7 } as const;

export const STAGE_LABEL: Record<Stage, string> = {
  inicial: 'inicial',
  intermedia: 'intermedia',
  final: 'final',
};

/** Retrocompatibilidad: los umbrales «clásicos» son los de la etapa intermedia. */
export const UMBRAL_ATENCION = DEFAULT_THRESHOLDS.intermedia.atencion;
export const UMBRAL_DESVIO = DEFAULT_THRESHOLDS.intermedia.desvio;

/** Etapa a partir del avance físico (0..1). */
export function stageOf(completion: number): Stage {
  if (completion < STAGE_BOUNDS.inicial) return 'inicial';
  if (completion < STAGE_BOUNDS.intermedia) return 'intermedia';
  return 'final';
}

/** Avance físico (EV/BAC) de un consolidado; 0 si aún no hay presupuesto. */
export function completionOf(ev: number, bac: number): number {
  return bac > 0 ? ev / bac : 0;
}

/**
 * Clasifica un índice (SPI o CPI) contra los umbrales de la etapa.
 *
 * @param index      valor del índice; `null` ⇒ sin-dato.
 * @param completion avance físico (0..1) para elegir la etapa. Si se omite, se
 *                   usa la etapa intermedia (criterio neutro, retrocompatible).
 * @param config     tabla de umbrales; por defecto {@link DEFAULT_THRESHOLDS}.
 */
export function classifyIndex(
  index: number | null,
  completion?: number | null,
  config: ThresholdConfig = DEFAULT_THRESHOLDS
): Status {
  if (index === null) return 'sin-dato';
  const stage = completion == null ? 'intermedia' : stageOf(completion);
  const t = config[stage];
  if (index >= t.atencion) return 'onplan';
  if (index >= t.desvio) return 'atencion';
  return 'desvio';
}

const SEVERITY: Record<Status, number> = {
  onplan: 0,
  'sin-dato': 1,
  atencion: 2,
  desvio: 3,
};

/** Devuelve el estado más severo entre varios. */
export function worstStatus(...statuses: Status[]): Status {
  return statuses.reduce((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst), 'onplan');
}
