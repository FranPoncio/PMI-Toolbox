import { describe, expect, it } from 'vitest';
import type { ProgressEntry, Project, WorkPackage } from '../core/types';
import { analyzeProject } from './decisions';

const project: Project = {
  id: 'p1',
  nombre: 'P',
  tipo: 'obra_civil',
  bac: 2000,
  fechaInicio: '2026-01-01',
  fechaFinPlan: '2026-12-31',
  moneda: 'USD',
};
const MITAD = '2026-07-02'; // t ≈ 0.5 ⇒ PV = presupuesto × 0.5

function wp(id: string, presupuesto: number, extra: Partial<WorkPackage> = {}): WorkPackage {
  return {
    id,
    projectId: 'p1',
    parentId: null,
    nombre: id,
    presupuesto,
    peso: presupuesto,
    fechaInicioPlan: '2026-01-01',
    fechaFinPlan: '2026-12-31',
    responsable: 'R',
    ...extra,
  };
}
function pe(wp: string, avance: number, costo: number, fecha = MITAD): ProgressEntry {
  return { id: `${wp}-pe`, workPackageId: wp, fechaCorte: fecha, avanceFisico: avance, costoRealAcum: costo };
}

describe('decisiones: orden y contenido', () => {
  // a: EV 400 / AC 600 ⇒ CPI 0.67, exposición ~500 (mayor).
  // b: EV 150 / AC 250 ⇒ CPI 0.60, exposición ~333 (menor).
  // c: EV 150 / AC 145 ⇒ en plan, no aparece.
  const wps = [wp('a', 1000), wp('b', 500), wp('c', 300)];
  const progress = new Map<string, ProgressEntry>([
    ['a', pe('a', 0.4, 600)],
    ['b', pe('b', 0.3, 250)],
    ['c', pe('c', 0.5, 145)],
  ]);

  it('ordena las decisiones por exposición económica descendente', () => {
    const r = analyzeProject(project, wps, progress, MITAD);
    expect(r.decisiones.map((d) => d.wpId)).toEqual(['a', 'b']);
    expect(r.decisiones[0]!.exposicion).toBeGreaterThan(r.decisiones[1]!.exposicion);
  });

  it('excluye los paquetes que están en plan', () => {
    const r = analyzeProject(project, wps, progress, MITAD);
    expect(r.decisiones.find((d) => d.wpId === 'c')).toBeUndefined();
  });

  it('la exposición es el sobrecosto proyectado por CPI (−VAC)', () => {
    const r = analyzeProject(project, wps, progress, MITAD);
    // a: EAC = BAC/CPI = 1000 / (400/600) = 1500 ⇒ VAC = −500 ⇒ exposición 500.
    const a = r.decisiones.find((d) => d.wpId === 'a')!;
    expect(a.exposicion).toBeCloseTo(500, 0);
  });

  it('el motivo explicita CPI, SPI y la etapa del paquete', () => {
    const r = analyzeProject(project, wps, progress, MITAD);
    const a = r.decisiones.find((d) => d.wpId === 'a')!;
    expect(a.motivo).toContain('CPI');
    expect(a.motivo).toContain('SPI');
    expect(a.motivo).toMatch(/etapa (inicial|intermedia|final)/);
  });
});

describe('decisiones: contexto de etapa', () => {
  it('un paquete casi terminado con desvío lo marca como etapa final y sin margen', () => {
    // d: 90% ejecutado (EV 180/200) con CPI 0.72 ⇒ etapa final.
    const wps = [wp('d', 200)];
    const progress = new Map<string, ProgressEntry>([['d', pe('d', 0.9, 250)]]);
    const r = analyzeProject(project, wps, progress, MITAD);
    const d = r.decisiones.find((x) => x.wpId === 'd')!;
    expect(d.motivo).toContain('etapa final');
    expect(d.motivo).toContain('margen');
  });
});

describe('flag iniciado', () => {
  it('un paquete que aún no arrancó a la fecha de corte tiene iniciado=false (PV=0)', () => {
    // 'z' arranca en septiembre; al corte de julio no tiene PV.
    const wps = [wp('z', 400, { fechaInicioPlan: '2026-09-01', fechaFinPlan: '2026-12-31' })];
    const r = analyzeProject(project, wps, new Map(), MITAD);
    const z = r.packages.find((p) => p.wp.id === 'z')!;
    expect(z.iniciado).toBe(false);
    expect(z.inputs.pv).toBe(0);
  });
});
