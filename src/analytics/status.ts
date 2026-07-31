/**
 * Clasificación de estado a partir de índices de desempeño (SPI/CPI).
 * Los tres estados mapean 1:1 con los colores semánticos de la paleta:
 *   onplan (verde) · atención (ámbar) · desvío (rojo).
 * `sin-dato` es para índices indefinidos (denominador 0 al arranque).
 */
export type Status = 'onplan' | 'atencion' | 'desvio' | 'sin-dato';

/** Umbrales de índice. Ajustables por tipo de proyecto más adelante. */
export const UMBRAL_ATENCION = 0.98;
export const UMBRAL_DESVIO = 0.9;

/** Clasifica un índice (SPI o CPI). `null` ⇒ sin-dato. */
export function classifyIndex(index: number | null): Status {
  if (index === null) return 'sin-dato';
  if (index >= UMBRAL_ATENCION) return 'onplan';
  if (index >= UMBRAL_DESVIO) return 'atencion';
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
