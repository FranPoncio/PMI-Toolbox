import { describe, expect, it } from 'vitest';
import { formatDateTime, index, months, pct, signedMonths } from './format';

describe('formatDateTime', () => {
  it('convierte ISO a "YYYY-MM-DD HH:mm"', () => {
    expect(formatDateTime('2026-07-30T18:00:00.000Z')).toBe('2026-07-30 18:00');
  });
  it('devuelve el string tal cual si no es ISO', () => {
    expect(formatDateTime('n/a')).toBe('n/a');
  });
});

describe('formateadores varios', () => {
  it('index / pct / months / signedMonths', () => {
    expect(index(0.807)).toBe('0.81');
    expect(index(null)).toBe('—');
    expect(pct(0.42)).toBe('42%');
    expect(months(18.9)).toBe('18.9 m');
    expect(signedMonths(-1.1)).toBe('−1.1 m');
    expect(signedMonths(2.4)).toBe('+2.4 m');
  });
});
