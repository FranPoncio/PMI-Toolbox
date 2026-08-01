import { describe, expect, it } from 'vitest';
import type { PlannedItem, Project } from '../core/types';
import { scheduleForecast } from './schedule';

const project: Project = {
  id: 'p1',
  nombre: 'P',
  tipo: 'obra_civil',
  bac: 1000,
  fechaInicio: '2026-01-01',
  fechaFinPlan: '2026-12-31',
  moneda: 'USD',
};

// Un único ítem que abarca todo el cronograma; con la curva S, PV(mitad)=500.
const items: PlannedItem[] = [
  { presupuesto: 1000, fechaInicioPlan: '2026-01-01', fechaFinPlan: '2026-12-31' },
];
const MITAD = '2026-07-02'; // t ≈ 0.5 del cronograma

describe('scheduleForecast', () => {
  it('en plan (EV = PV a la fecha) ⇒ SPI(t) ≈ 1 y fin ≈ planificado', () => {
    const f = scheduleForecast(project, items, 1000, 500, MITAD);
    expect(f.spit).toBeCloseTo(1, 1);
    expect(f.atrasoMeses).toBeCloseTo(0, 1);
    expect(f.fechaFinPronosticada).not.toBeNull();
  });

  it('atrasado (EV < PV a la fecha) ⇒ SPI(t) < 1, atraso > 0 y fin posterior al plan', () => {
    const f = scheduleForecast(project, items, 1000, 300, MITAD);
    expect(f.spit).not.toBeNull();
    expect(f.spit!).toBeLessThan(1);
    expect(f.svtMonths).toBeLessThan(0); // ES por detrás de AT
    expect(f.atrasoMeses!).toBeGreaterThan(0);
    expect(Date.parse(f.fechaFinPronosticada!)).toBeGreaterThan(Date.parse(project.fechaFinPlan));
  });

  it('sin tiempo transcurrido (fecha = inicio) ⇒ SPI(t) y pronóstico null', () => {
    const f = scheduleForecast(project, items, 1000, 0, project.fechaInicio);
    expect(f.spit).toBeNull();
    expect(f.ieacMonths).toBeNull();
    expect(f.fechaFinPronosticada).toBeNull();
    expect(f.atrasoMeses).toBeNull();
  });

  it('con todo el valor ganado ⇒ Earned Schedule = duración planificada', () => {
    const f = scheduleForecast(project, items, 1000, 1000, MITAD);
    expect(f.esMonths).toBeCloseTo(f.pdMonths, 5);
  });

  it('la duración planificada ronda los 12 meses', () => {
    const f = scheduleForecast(project, items, 1000, 500, MITAD);
    expect(f.pdMonths).toBeGreaterThan(11.5);
    expect(f.pdMonths).toBeLessThan(12.5);
  });
});
