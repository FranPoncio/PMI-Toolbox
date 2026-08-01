import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../analytics/status';
import { db } from '../db/db';
import { usePmStore } from './pmStore';

/** Estado inicial limpio del store (los actions son closures, se conservan). */
function resetState() {
  usePmStore.setState({
    status: 'idle',
    projects: [],
    selectedProjectId: null,
    workPackages: [],
    progressEntries: [],
    baselines: [],
    auditLog: [],
    users: [],
    currentUserId: null,
    dataDate: null,
    thresholds: DEFAULT_THRESHOLDS,
  });
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  localStorage.clear();
  resetState();
});

const s = () => usePmStore.getState();

describe('init / seed', () => {
  it('siembra usuarios y el proyecto de ejemplo, y queda listo', async () => {
    await s().init();
    expect(s().status).toBe('ready');
    expect(s().users.length).toBeGreaterThan(0);
    expect(s().projects.length).toBeGreaterThan(0);
    expect(s().currentUserId).not.toBeNull();
    expect(s().selectedProjectId).not.toBeNull();
    expect(s().dataDate).not.toBeNull();
    expect(s().workPackages.length).toBeGreaterThan(0);
  });

  it('es idempotente: un segundo init no vuelve a sembrar', async () => {
    await s().init();
    const nProy = s().projects.length;
    await s().init();
    expect(s().projects.length).toBe(nProy);
  });
});

describe('altas con trazabilidad', () => {
  it('crear un proyecto lo selecciona y registra la acción en la bitácora', async () => {
    await s().init();
    const id = await s().saveProject({
      nombre: 'Proyecto nuevo',
      tipo: 'industrial',
      bac: 500,
      fechaInicio: '2026-01-01',
      fechaFinPlan: '2026-12-31',
      moneda: 'USD',
    });
    expect(s().selectedProjectId).toBe(id);
    expect(s().projects.some((p) => p.id === id)).toBe(true);
    // La bitácora del proyecto recién creado tiene la acción de creación.
    expect(
      s().auditLog.some((e) => e.action === 'crear' && e.entity === 'proyecto')
    ).toBe(true);
    // Atribuida al usuario de la sesión.
    expect(s().auditLog[0]!.userId).toBe(s().currentUserId);
  });

  it('cargar un corte manual guarda los avances y lo registra en la bitácora', async () => {
    await s().init();
    const leaf = s().workPackages.find((w) => w.presupuesto > 0)!;
    await s().importProgress(
      [{ workPackageId: leaf.id, fechaCorte: '2026-08-01', avanceFisico: 0.5, costoRealAcum: 1000 }],
      'manual'
    );
    expect(
      s().progressEntries.some((p) => p.workPackageId === leaf.id && p.fechaCorte === '2026-08-01')
    ).toBe(true);
    expect(
      s().auditLog.some((e) => e.entity === 'corte' && e.resumen.includes('2026-08-01'))
    ).toBe(true);
  });
});

describe('línea base', () => {
  it('congelar incrementa la versión y registra la acción', async () => {
    await s().init();
    const antes = s().baselines.length;
    const maxVer = s().baselines.reduce((m, b) => Math.max(m, b.version), 0);
    await s().freezeBaseline('2026-08-01', 'Rebaseline de prueba');
    expect(s().baselines.length).toBe(antes + 1);
    expect(s().baselines.some((b) => b.version === maxVer + 1)).toBe(true);
    expect(s().auditLog.some((e) => e.entity === 'linea_base')).toBe(true);
  });
});

describe('borrado en cascada de la WBS', () => {
  it('borrar un resumen elimina también sus descendientes', async () => {
    await s().init();
    const pid = await s().saveProject({
      nombre: 'Con jerarquía',
      tipo: 'obra_civil',
      bac: 0,
      fechaInicio: '2026-01-01',
      fechaFinPlan: '2026-12-31',
      moneda: 'USD',
    });
    const base = {
      projectId: pid,
      peso: 1,
      fechaInicioPlan: '2026-01-01',
      fechaFinPlan: '2026-12-31',
      responsable: '',
    };
    await s().saveWorkPackage({ ...base, nombre: 'Fase', presupuesto: 0 });
    const fase = s().workPackages.find((w) => w.nombre === 'Fase')!;
    await s().saveWorkPackage({ ...base, nombre: 'Tarea', presupuesto: 100, parentId: fase.id });
    expect(s().workPackages).toHaveLength(2);

    await s().removeWorkPackage(fase.id);
    expect(s().workPackages).toHaveLength(0); // padre e hijo eliminados
  });
});

describe('umbrales configurables', () => {
  it('setThresholds actualiza el estado y persiste en localStorage', async () => {
    await s().init();
    const custom = {
      ...DEFAULT_THRESHOLDS,
      final: { atencion: 1.0, desvio: 0.97 },
    };
    s().setThresholds(custom);
    expect(s().thresholds.final.desvio).toBe(0.97);
    expect(localStorage.getItem('pmi-toolbox.thresholds')).toContain('0.97');
  });

  it('resetThresholds restaura los valores de fábrica', async () => {
    await s().init();
    s().setThresholds({ ...DEFAULT_THRESHOLDS, final: { atencion: 1.0, desvio: 0.97 } });
    s().resetThresholds();
    expect(s().thresholds).toEqual(DEFAULT_THRESHOLDS);
  });
});
