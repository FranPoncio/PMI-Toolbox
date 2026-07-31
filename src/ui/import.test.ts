import { describe, expect, it } from 'vitest';
import type { WorkPackage } from '../core/types';
import { parseActuals, parseSchedule } from './import';

function wp(id: string, nombre: string): WorkPackage {
  return {
    id,
    projectId: 'p1',
    nombre,
    presupuesto: 1000,
    peso: 1,
    fechaInicioPlan: '2026-01-01',
    fechaFinPlan: '2026-12-31',
    responsable: '',
  };
}

describe('parseSchedule', () => {
  it('detecta columnas y valida (una válida, una con error)', () => {
    const csv =
      'nombre,presupuesto,inicio,fin,responsable\n' +
      'Ingeniería,850000,2025-09-01,2026-03-31,M. A.\n' +
      'Mala,,foo,2026-01-01,X';
    const r = parseSchedule(csv);
    expect(r.validas).toBe(1);
    expect(r.rows[0]!.draft?.presupuesto).toBe(850000);
    expect(r.rows[1]!.draft).toBeNull();
    expect(r.rows[1]!.errores.length).toBeGreaterThan(0);
  });

  it('sin columnas mínimas ⇒ errorGeneral', () => {
    expect(parseSchedule('a,b\n1,2').errorGeneral).toBeTruthy();
  });
});

describe('parseActuals', () => {
  const wps = [wp('a', 'Ingeniería de detalle'), wp('b', 'Obras civiles')];

  it('empareja por nombre y parsea avance (%) y costo', () => {
    const csv =
      'paquete,fecha,avance,costo\n' +
      'Ingeniería de detalle,30/06/2026,100,910000\n' +
      'Obras civiles,2026-06-30,42,1.650.000';
    const r = parseActuals(csv, wps);
    expect(r.validas).toBe(2);
    expect(r.rows[0]!.draft).toMatchObject({
      workPackageId: 'a',
      fechaCorte: '2026-06-30',
      avanceFisico: 1,
      costoRealAcum: 910000,
    });
    // Formato es-AR de miles en el costo.
    expect(r.rows[1]!.draft?.costoRealAcum).toBe(1650000);
    expect(r.rows[1]!.draft?.avanceFisico).toBeCloseTo(0.42, 4);
  });

  it('marca error si el paquete no existe', () => {
    const r = parseActuals('paquete,fecha,avance,costo\nInexistente,2026-06-30,10,100', wps);
    expect(r.validas).toBe(0);
    expect(r.rows[0]!.errores).toContain('paquete no encontrado');
  });

  it('sin columnas mínimas ⇒ errorGeneral', () => {
    expect(parseActuals('x,y\n1,2', wps).errorGeneral).toBeTruthy();
  });
});
