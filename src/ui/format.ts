/** Formateadores de la interfaz. Todas las cifras usan es-AR. */

export function money(value: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Monto con signo explícito (+/−). Para variaciones. `null` ⇒ "—". */
export function signedMoney(value: number | null, currency: string): string {
  if (value === null) return '—';
  const s = money(Math.abs(value), currency);
  return value < 0 ? `−${s}` : value > 0 ? `+${s}` : s;
}

/** Índice adimensional a 2 decimales. `null` ⇒ "—". */
export function index(value: number | null): string {
  return value === null ? '—' : value.toFixed(2);
}

/** Índice con signo respecto de 1.00 (ej.: "−0,19"). `null` ⇒ "—". */
export function indexDelta(value: number | null): string {
  if (value === null) return '—';
  const d = value - 1;
  const s = Math.abs(d).toFixed(2);
  return d < 0 ? `−${s}` : d > 0 ? `+${s}` : '0,00';
}

/** Porcentaje entero a partir de una fracción 0..1. */
export function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
