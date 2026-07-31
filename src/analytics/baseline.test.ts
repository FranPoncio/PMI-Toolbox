import { describe, expect, it } from 'vitest';
import type { Baseline, ProgressEntry, Project, WorkPackage } from '../core/types';
import { analyzeProject } from './decisions';
import {
  activeBaseline,
  buildBaselineSnapshot,
  diffBaseline,
  effectiveBac,
  effectivePlanItem,
} from './baseline';

const project: Project = {
  id: 'p1',
  nombre: 'Proyecto',
  tipo: 'obra_civil',
  bac: 1000,
  fechaInicio: '2026-01-01',
  fechaFinPlan: '2026-12-31',
  moneda: 'USD',
};

function wp(id: string, presupuesto: number): WorkPackage {
  return {
    id,
    projectId: 'p1',
    nombre: id,
    presupuesto,
    peso: presupuesto,
    fechaInicioPlan: '2026-01-01',
    fechaFinPlan: '2026-12-31',
    responsable: 'n/a',
  };
}

const wps: WorkPackage[] = [wp('a', 400), wp('b', 600)];

function baselineFrom(list: WorkPackage[], version = 1): Baseline {
  return { ...buildBaselineSnapshot(project, list, version, '2026-01-01', 'inicial'), id: `bl-${version}` };
}

describe('buildBaselineSnapshot', () => {
  it('congela BAC = suma de presupuestos y una foto por paquete', () => {
    const b = baselineFrom(wps);
    expect(b.bac).toBe(1000);
    expect(b.items).toHaveLength(2);
    expect(b.items[0]).toMatchObject({ workPackageId: 'a', presupuesto: 400 });
    expect(b.activa).toBe(true);
  });
});

describe('activeBaseline', () => {
  it('devuelve la marcada como activa', () => {
    const v1 = { ...baselineFrom(wps, 1), activa: false };
    const v2 = baselineFrom(wps, 2);
    expect(activeBaseline([v1, v2])?.version).toBe(2);
    expect(activeBaseline([])).toBeUndefined();
  });
});

describe('effectivePlanItem / effectiveBac', () => {
  it('usa la foto de la base cuando existe, no el valor vivo', () => {
    const base = baselineFrom(wps);
    const vivoEditado = { ...wps[0]!, presupuesto: 999 };
    // Aunque el paquete vivo cambió a 999, el plan efectivo sigue en 400.
    expect(effectivePlanItem(vivoEditado, base).presupuesto).toBe(400);
  });

  it('usa el valor vivo para alcance nuevo sin foto en la base', () => {
    const base = baselineFrom(wps);
    const nuevo = wp('c', 250);
    expect(effectivePlanItem(nuevo, base).presupuesto).toBe(250);
  });

  it('BAC efectivo es el de la base activa; sin base, la suma viva', () => {
    const base = baselineFrom(wps);
    expect(effectiveBac([{ ...wps[0]!, presupuesto: 999 }, wps[1]!], base)).toBe(1000);
    expect(effectiveBac(wps, undefined)).toBe(1000);
  });
});

describe('diffBaseline', () => {
  const base = baselineFrom(wps);

  it('sin cambios ⇒ no diverge', () => {
    expect(diffBaseline(base, wps).cambio).toBe(false);
  });

  it('detecta modificados, agregados y quitados', () => {
    const modificado = { ...wps[0]!, presupuesto: 500 };
    const agregado = wp('c', 100);
    const d = diffBaseline(base, [modificado, agregado]); // falta 'b' (quitado)
    expect(d.cambio).toBe(true);
    expect(d.modificados).toContain('a');
    expect(d.agregados).toContain('c');
    expect(d.quitados).toContain('b');
  });

  it('sin base ⇒ nunca diverge', () => {
    expect(diffBaseline(undefined, wps).cambio).toBe(false);
  });
});

describe('semántica de congelado en analyzeProject', () => {
  const progress = new Map<string, ProgressEntry>([
    ['a', { id: 'a-pe', workPackageId: 'a', fechaCorte: '2026-07-01', avanceFisico: 0.5, costoRealAcum: 250 }],
  ]);

  it('editar el presupuesto vivo NO mueve el PV/BAC medidos contra la base', () => {
    const base = baselineFrom(wps);
    const editado = [{ ...wps[0]!, presupuesto: 4000 }, wps[1]!]; // 'a' inflado 10x

    const conBase = analyzeProject(project, editado, progress, '2026-07-01', base);
    const sinBase = analyzeProject(project, editado, progress, '2026-07-01', undefined);

    // Con base: BAC sigue congelado en 1000; sin base salta a 4600.
    expect(conBase.evm.bac).toBe(1000);
    expect(sinBase.evm.bac).toBe(4600);
    // El EV con base usa el presupuesto congelado de 'a' (400 × 0.5 = 200).
    expect(conBase.evm.ev).toBeCloseTo(200, 6);
  });
});
