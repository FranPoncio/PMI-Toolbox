import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../core/types';
import { MemoryRepository } from './memoryRepository';
import { ChangeQueue, MockSyncAdapter, type Change, type SyncAdapter } from './sync';
import { SyncingRepository } from './syncingRepository';

const proj = (id: string): Project => ({
  id,
  nombre: id,
  tipo: 'obra_civil',
  bac: 1000,
  fechaInicio: '2026-01-01',
  fechaFinPlan: '2026-12-31',
  moneda: 'USD',
});

let n = 0;
const nextId = () => `chg-${++n}`;

beforeEach(() => {
  n = 0;
  localStorage.clear();
});

describe('ChangeQueue', () => {
  it('encola, cuenta y des-encola lo confirmado; persiste en localStorage', () => {
    const q = new ChangeQueue('test.queue');
    const c: Change = { id: 'c1', ts: 't', entity: 'project', op: 'put', ref: 'p1' };
    q.enqueue(c);
    q.enqueue({ ...c, id: 'c2' });
    expect(q.count()).toBe(2);
    q.markSynced(['c1']);
    expect(q.pending().map((x) => x.id)).toEqual(['c2']);
    // Una cola nueva con la misma clave recupera lo pendiente.
    expect(new ChangeQueue('test.queue').count()).toBe(1);
  });
});

describe('SyncingRepository', () => {
  it('registra un cambio por cada mutación y lo empuja al adaptador', async () => {
    const pushed: Change[] = [];
    const adapter = new MockSyncAdapter((cs) => pushed.push(...cs));
    const repo = new SyncingRepository(new MemoryRepository(), new ChangeQueue('t'), adapter, nextId);

    await repo.putProject(proj('p1'));
    await repo.flush(); // asegura el drenaje (el push es fire-and-forget)

    expect(pushed.map((c) => c.entity)).toContain('project');
    expect(repo.pendingChangeCount()).toBe(0); // el mock acepta todo
  });

  it('offline: si el push falla, el cambio queda encolado para reintentar', async () => {
    const failing: SyncAdapter = {
      name: 'down',
      push: () => Promise.reject(new Error('sin red')),
    };
    const repo = new SyncingRepository(new MemoryRepository(), new ChangeQueue('t'), failing, nextId);

    await repo.putProject(proj('p1'));
    await repo.flush();
    expect(repo.pendingChangeCount()).toBe(1); // sigue pendiente

    // Vuelve la conexión: al drenar contra un adaptador sano, la cola se vacía.
    const ok = new MockSyncAdapter();
    const repo2 = new SyncingRepository(new MemoryRepository(), new ChangeQueue('t'), ok, nextId);
    await repo2.flush();
    expect(repo2.pendingChangeCount()).toBe(0);
  });

  it('el bootstrap (bulkInsert / bulkPutUsers) NO genera cambios de sync', async () => {
    const spy = vi.fn();
    const repo = new SyncingRepository(
      new MemoryRepository(),
      new ChangeQueue('t'),
      new MockSyncAdapter(spy),
      nextId
    );
    await repo.bulkInsert([proj('p1')], [], []);
    await repo.bulkPutUsers([{ id: 'u1', nombre: 'U', rol: 'analista' }]);
    await repo.flush();
    expect(repo.pendingChangeCount()).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});
