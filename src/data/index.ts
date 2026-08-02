/**
 * Punto de armado de la capa de datos. El resto de la app importa `repo` de acá
 * y no sabe (ni le importa) qué hay debajo.
 *
 * Composición actual:
 *   SyncingRepository( DexieRepository(IndexedDB) , ChangeQueue , MockSyncAdapter )
 *
 * Para conectar un backend real, se cambia `MockSyncAdapter` por un adaptador
 * HTTP que hable con la API. Nada del store ni de la UI cambia.
 */

import { db, newId } from '../db/db';
import { DexieRepository } from './dexieRepository';
import type { Repository } from './repository';
import { ChangeQueue, MockSyncAdapter } from './sync';
import { SyncingRepository } from './syncingRepository';

export type { Repository } from './repository';
export type { Change, SyncAdapter, SyncEntity, SyncOp, PushResult } from './sync';
export { ChangeQueue, MockSyncAdapter } from './sync';
export { DexieRepository } from './dexieRepository';
export { MemoryRepository } from './memoryRepository';
export { SyncingRepository } from './syncingRepository';

/** Repositorio base (IndexedDB) sin sync — lo usa el bootstrap/seed. */
export const baseRepo: Repository = new DexieRepository(db);

/** Repositorio de la app: IndexedDB + cola de cambios + adaptador de sync. */
export const repo = new SyncingRepository(baseRepo, new ChangeQueue(), new MockSyncAdapter(), newId);
