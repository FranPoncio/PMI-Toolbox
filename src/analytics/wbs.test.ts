import { describe, expect, it } from 'vitest';
import type { ProgressEntry, Project, WorkPackage } from '../core/types';
import { analyzeProject } from './decisions';
import { childrenOf, isLeaf, leaves, parentCandidates, roots, subtreeIds } from './wbs';

const project: Project = {
  id: 'p1',
  nombre: 'P',
  tipo: 'obra_civil',
  bac: 1000,
  fechaInicio: '2026-01-01',
  fechaFinPlan: '2026-12-31',
  moneda: 'USD',
};

function wp(id: string, parentId: string | null, presupuesto: number): WorkPackage {
  return {
    id,
    projectId: 'p1',
    parentId,
    nombre: id,
    presupuesto,
    peso: presupuesto,
    fechaInicioPlan: '2026-01-01',
    fechaFinPlan: '2026-12-31',
    responsable: '',
  };
}

// Árbol: g1 → (a=400, b=600). g1 es resumen (presupuesto 0).
const wps: WorkPackage[] = [wp('g1', null, 0), wp('a', 'g1', 400), wp('b', 'g1', 600)];

describe('helpers de WBS', () => {
  it('roots / leaves / childrenOf / isLeaf', () => {
    expect(roots(wps).map((w) => w.id)).toEqual(['g1']);
    expect(leaves(wps).map((w) => w.id).sort()).toEqual(['a', 'b']);
    expect(childrenOf('g1', wps).map((w) => w.id).sort()).toEqual(['a', 'b']);
    expect(isLeaf(wps[0]!, wps)).toBe(false);
    expect(isLeaf(wps[1]!, wps)).toBe(true);
  });

  it('subtreeIds incluye el nodo y sus descendientes', () => {
    expect(subtreeIds('g1', wps).sort()).toEqual(['a', 'b', 'g1']);
  });

  it('parentCandidates excluye el propio nodo y su subárbol', () => {
    // Candidatos a padre de g1: nadie (a y b son sus descendientes).
    expect(parentCandidates(wps, 'g1')).toEqual([]);
    // Candidatos a padre de a: g1 y b.
    expect(parentCandidates(wps, 'a').map((w) => w.id).sort()).toEqual(['b', 'g1']);
  });
});

describe('roll-up en analyzeProject', () => {
  // a: 50% avance, costo 250. b: sin reporte.
  const progress = new Map<string, ProgressEntry>([
    ['a', { id: 'a-pe', workPackageId: 'a', fechaCorte: '2026-07-01', avanceFisico: 0.5, costoRealAcum: 250 }],
  ]);

  it('el consolidado suma solo las hojas (sin doble conteo del resumen)', () => {
    const r = analyzeProject(project, wps, progress, '2026-07-01');
    // BAC = 400 + 600 = 1000 (no 2000 por sumar el resumen).
    expect(r.evm.bac).toBe(1000);
    // EV = 400×0.5 = 200; AC = 250.
    expect(r.evm.ev).toBeCloseTo(200, 6);
    expect(r.evm.ac).toBe(250);
    // packages = solo hojas.
    expect(r.packages.map((p) => p.wp.id).sort()).toEqual(['a', 'b']);
  });

  it('el nodo de resumen refleja el roll-up de sus hijos', () => {
    const r = analyzeProject(project, wps, progress, '2026-07-01');
    expect(r.tree).toHaveLength(1);
    const g1 = r.tree[0]!;
    expect(g1.wp.id).toBe('g1');
    expect(g1.isLeaf).toBe(false);
    expect(g1.inputs.bac).toBe(1000);
    expect(g1.inputs.ev).toBeCloseTo(200, 6);
    expect(g1.inputs.ac).toBe(250);
    // El roll-up del resumen coincide con el consolidado.
    expect(g1.inputs.pv).toBeCloseTo(r.evm.pv, 6);
    expect(g1.children.map((c) => c.wp.id).sort()).toEqual(['a', 'b']);
  });
});
