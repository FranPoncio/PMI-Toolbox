import { describe, expect, it } from 'vitest';
import type { ProgressEntry } from '../core/types';
import {
  allCutDates,
  cutDatesUpTo,
  evmHistory,
  vigenteByWp,
  type EffectiveItem,
} from './resolve';

function pe(wp: string, fecha: string, avance: number, costo: number): ProgressEntry {
  return { id: `${wp}-${fecha}`, workPackageId: wp, fechaCorte: fecha, avanceFisico: avance, costoRealAcum: costo };
}

// 'a' reporta tres cortes; 'b' uno solo.
const entries: ProgressEntry[] = [
  pe('a', '2026-03-31', 0.2, 100),
  pe('a', '2026-05-31', 0.5, 300),
  pe('a', '2026-07-31', 0.8, 520),
  pe('b', '2026-05-31', 0.4, 200),
];

describe('vigenteByWp', () => {
  it('toma, por paquete, el corte más reciente con fecha ≤ dataDate', () => {
    const v = vigenteByWp(entries, '2026-06-15');
    expect(v.get('a')?.fechaCorte).toBe('2026-05-31'); // no toma el de julio
    expect(v.get('b')?.fechaCorte).toBe('2026-05-31');
  });

  it('ignora los cortes futuros a la fecha', () => {
    const v = vigenteByWp(entries, '2026-04-01');
    expect(v.get('a')?.fechaCorte).toBe('2026-03-31');
    expect(v.get('b')).toBeUndefined(); // 'b' aún no había reportado
  });

  it('en la fecha exacta del corte, ese corte es el vigente (≤ inclusive)', () => {
    const v = vigenteByWp(entries, '2026-05-31');
    expect(v.get('a')?.fechaCorte).toBe('2026-05-31');
  });
});

describe('cutDatesUpTo / allCutDates', () => {
  it('cutDatesUpTo devuelve fechas distintas ≤ dataDate, ordenadas', () => {
    expect(cutDatesUpTo(entries, '2026-06-01')).toEqual(['2026-03-31', '2026-05-31']);
  });

  it('allCutDates devuelve todas las fechas distintas ordenadas', () => {
    expect(allCutDates(entries)).toEqual(['2026-03-31', '2026-05-31', '2026-07-31']);
  });
});

describe('evmHistory', () => {
  const items: EffectiveItem[] = [
    { id: 'a', presupuesto: 1000, fechaInicioPlan: '2026-01-01', fechaFinPlan: '2026-12-31' },
    { id: 'b', presupuesto: 500, fechaInicioPlan: '2026-01-01', fechaFinPlan: '2026-12-31' },
  ];

  it('EV y AC de cada fecha usan el corte vigente de cada paquete', () => {
    const serie = evmHistory(items, entries, ['2026-03-31', '2026-05-31']);
    // 2026-03-31: solo 'a' (0.2). EV = 1000×0.2 = 200; AC = 100.
    expect(serie[0]!.ev).toBeCloseTo(200, 6);
    expect(serie[0]!.ac).toBe(100);
    // 2026-05-31: 'a' (0.5) + 'b' (0.4). EV = 500 + 200 = 700; AC = 300 + 200 = 500.
    expect(serie[1]!.ev).toBeCloseTo(700, 6);
    expect(serie[1]!.ac).toBe(500);
  });

  it('el PV crece monótonamente y es independiente de los cortes reportados', () => {
    const serie = evmHistory(items, entries, ['2026-03-31', '2026-07-31']);
    expect(serie[1]!.pv).toBeGreaterThan(serie[0]!.pv);
  });
});
