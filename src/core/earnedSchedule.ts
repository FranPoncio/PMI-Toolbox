/**
 * Earned Schedule (ES) — la extensión temporal de EVM.
 *
 * El EVM clásico mide el atraso en dinero (SV = EV − PV), lo cual es engañoso:
 * al final del proyecto SV siempre tiende a 0 aunque se termine tardísimo.
 * Earned Schedule traduce el avance a *tiempo*: ¿en qué momento del plan
 * estaba previsto haber ganado lo que hoy tenemos ganado? Ese instante es el
 * Earned Schedule.
 *
 * Estas funciones son puras y trabajan sobre la curva de PV acumulado.
 */

/**
 * Fracción de la duración planificada correspondiente al Earned Schedule:
 * el `t ∈ [0,1]` tal que `pvAt(t) = evNow`, hallado por bisección (la curva de
 * PV acumulado es monótona creciente).
 *
 *  - Si `evNow ≤ 0` ⇒ 0 (nada ganado).
 *  - Si `evNow ≥ bac` ⇒ 1 (se ganó todo el alcance).
 *
 * @param pvAt  PV acumulado en función del tiempo normalizado (t 0..1).
 * @param evNow Earned Value a la fecha de corte.
 * @param bac   PV total (= pvAt(1)).
 */
export function earnedScheduleFraction(
  pvAt: (t: number) => number,
  evNow: number,
  bac: number,
  iterations = 48
): number {
  if (evNow <= 0) return 0;
  if (evNow >= bac) return 1;

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    if (pvAt(mid) < evNow) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Schedule Performance Index (tiempo) = ES / AT.
 * `null` si el tiempo transcurrido (AT) es 0.
 */
export function spiTime(esMonths: number, atMonths: number): number | null {
  if (atMonths === 0) return null;
  return esMonths / atMonths;
}

/**
 * Schedule Variance (tiempo) = ES − AT. En las mismas unidades que ES/AT.
 * Positivo = adelantado; negativo = atrasado.
 */
export function scheduleVarianceTime(esMonths: number, atMonths: number): number {
  return esMonths - atMonths;
}

/**
 * Duración estimada a fin (IEAC-t) = PD / SPI(t): a este ritmo de avance
 * temporal, cuánto durará el proyecto en total. `null` si SPI(t) es `null` o 0.
 */
export function independentEacTime(pdMonths: number, spit: number | null): number | null {
  if (spit === null || spit === 0) return null;
  return pdMonths / spit;
}
