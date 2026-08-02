import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditEntry, Baseline, ProgressEntry, Project, User, WorkPackage } from '../core/types';
import { db } from '../db/db';
import { DexieRepository } from './dexieRepository';
import { MemoryRepository } from './memoryRepository';
import type { Repository } from './repository';

const proj = (id: string, nombre: string): Project => ({
  id,
  nombre,
  tipo: 'obra_civil',
  bac: 1000,
  fechaInicio: '2026-01-01',
  fechaFinPlan: '2026-12-31',
  moneda: 'USD',
});
const wp = (id: string, projectId: string): WorkPackage => ({
  id,
  projectId,
  parentId: null,
  nombre: id,
  presupuesto: 100,
  peso: 100,
  fechaInicioPlan: '2026-01-01',
  fechaFinPlan: '2026-12-31',
  responsable: 'R',
});
const pe = (id: string, workPackageId: string): ProgressEntry => ({
  id,
  workPackageId,
  fechaCorte: '2026-06-01',
  avanceFisico: 0.5,
  costoRealAcum: 50,
});
const baseline = (id: string, projectId: string, version: number): Baseline => ({
  id,
  projectId,
  version,
  fechaAprobacion: '2026-01-01',
  motivo: 'x',
  bac: 100,
  activa: true,
  items: [],
});
const audit = (id: string, projectId: string, ts: string): AuditEntry => ({
  id,
  ts,
  projectId,
  userId: 'u1',
  userNombre: 'U',
  userRol: 'analista',
  action: 'crear',
  entity: 'proyecto',
  resumen: 'r',
});
const user = (id: string, nombre: string): User => ({ id, nombre, rol: 'analista' });

/** Corre la MISMA batería contra cualquier implementación del puerto. */
function contract(name: string, make: () => Promise<Repository>) {
  describe(`Repository contract — ${name}`, () => {
    let r: Repository;
    beforeEach(async () => {
      r = await make();
    });

    it('proyectos: put / list (orden por nombre) / get / delete', async () => {
      await r.putProject(proj('p2', 'Beta'));
      await r.putProject(proj('p1', 'Alfa'));
      expect((await r.listProjects()).map((p) => p.nombre)).toEqual(['Alfa', 'Beta']);
      expect((await r.getProject('p1'))?.nombre).toBe('Alfa');
      await r.deleteProject('p1');
      expect(await r.getProject('p1')).toBeUndefined();
    });

    it('borrar un proyecto elimina en cascada sus paquetes y cortes', async () => {
      await r.putProject(proj('p1', 'P'));
      await r.putWorkPackage(wp('w1', 'p1'));
      await r.putProgressEntry(pe('pe1', 'w1'));
      await r.deleteProject('p1');
      expect(await r.listWorkPackages('p1')).toHaveLength(0);
      expect(await r.listProgressForProject('p1')).toHaveLength(0);
    });

    it('cortes: se listan por proyecto vía sus paquetes', async () => {
      await r.putProject(proj('p1', 'P'));
      await r.bulkPutWorkPackages([wp('w1', 'p1'), wp('w2', 'p1')]);
      await r.bulkPutProgress([pe('pe1', 'w1'), pe('pe2', 'w2')]);
      expect(await r.listProgressForProject('p1')).toHaveLength(2);
      await r.deleteWorkPackage('w1'); // arrastra su corte
      expect(await r.listProgressForProject('p1')).toHaveLength(1);
    });

    it('freezeBaseline: al congelar una nueva, desactiva las previas activas', async () => {
      await r.freezeBaseline(baseline('b1', 'p1', 1));
      await r.freezeBaseline(baseline('b2', 'p1', 2));
      const list = await r.listBaselines('p1');
      expect(list.map((b) => b.version)).toEqual([1, 2]); // orden asc
      expect(list.find((b) => b.version === 1)!.activa).toBe(false);
      expect(list.find((b) => b.version === 2)!.activa).toBe(true);
    });

    it('auditoría: append-only y listada por proyecto, más reciente primero', async () => {
      await r.appendAudit(audit('a1', 'p1', '2026-01-01T10:00:00.000Z'));
      await r.appendAudit(audit('a2', 'p1', '2026-03-01T10:00:00.000Z'));
      await r.appendAudit(audit('a3', 'p2', '2026-02-01T10:00:00.000Z'));
      const log = await r.listAudit('p1');
      expect(log.map((e) => e.id)).toEqual(['a2', 'a1']); // desc por ts, solo p1
    });

    it('usuarios y contadores; bulkInsert carga en bloque', async () => {
      await r.bulkPutUsers([user('u2', 'Beto'), user('u1', 'Ana')]);
      expect((await r.listUsers()).map((u) => u.nombre)).toEqual(['Ana', 'Beto']);
      expect(await r.countUsers()).toBe(2);
      await r.bulkInsert([proj('p1', 'P'), proj('p2', 'Q')], [wp('w1', 'p1')], [pe('pe1', 'w1')]);
      expect(await r.countProjects()).toBe(2);
      expect(await r.listWorkPackages('p1')).toHaveLength(1);
    });
  });
}

contract('memory', async () => new MemoryRepository());
contract('dexie', async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  return new DexieRepository(db);
});
