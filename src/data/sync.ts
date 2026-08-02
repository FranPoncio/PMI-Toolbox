/**
 * Capa de sincronización (offline-first). Toda mutación local se registra como
 * un {@link Change} en una cola persistente; un {@link SyncAdapter} los empuja
 * al servidor cuando hay conexión. Si no hay servidor (o está caído), los
 * cambios quedan encolados y se reintentan — la app sigue funcionando local.
 *
 * Hoy el adaptador es un mock (no hay backend). Conectar uno real es
 * implementar `SyncAdapter` contra la API — nada más de la app cambia.
 */

export type SyncEntity =
  | 'project'
  | 'workPackage'
  | 'progress'
  | 'baseline'
  | 'user'
  | 'audit';

export type SyncOp = 'put' | 'bulkPut' | 'delete';

/** Un cambio local pendiente de enviar al servidor. */
export interface Change {
  /** Id del propio cambio (para des-duplicar en el server). */
  id: string;
  /** Marca temporal ISO de cuándo ocurrió. */
  ts: string;
  entity: SyncEntity;
  op: SyncOp;
  /** Id(s) de la(s) entidad(es) afectada(s). */
  ref: string | string[];
}

/** Resultado de empujar cambios: los que el servidor aceptó (se des-encolan). */
export interface PushResult {
  acceptedIds: string[];
}

/**
 * Contrato del transporte de sincronización. Un backend real implementa esto
 * contra su API; el mock lo simula sin red.
 */
export interface SyncAdapter {
  readonly name: string;
  push(changes: Change[]): Promise<PushResult>;
  /** Trae cambios del servidor desde una marca temporal (opcional por ahora). */
  pull?(sinceTs: string | null): Promise<{ changes: Change[]; ts: string }>;
}

/**
 * Adaptador de sincronización simulado: no hay servidor todavía. Acepta todos
 * los cambios (para que la cola drene) y opcionalmente los reporta por callback,
 * útil para inspección/tests. Reemplazable por un adaptador HTTP real.
 */
export class MockSyncAdapter implements SyncAdapter {
  readonly name = 'mock';
  constructor(private readonly onPush?: (changes: Change[]) => void) {}

  async push(changes: Change[]): Promise<PushResult> {
    this.onPush?.(changes);
    return { acceptedIds: changes.map((c) => c.id) };
  }

  async pull(): Promise<{ changes: Change[]; ts: string }> {
    return { changes: [], ts: new Date().toISOString() };
  }
}

/**
 * Cola de cambios pendientes, persistida en localStorage para sobrevivir a un
 * reload. Si no hay localStorage (p. ej. SSR), degrada a memoria.
 */
export class ChangeQueue {
  private mem: Change[];

  constructor(private readonly key = 'pmi-toolbox.syncQueue') {
    this.mem = this.read();
  }

  private read(): Change[] {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.key) : null;
      return raw ? (JSON.parse(raw) as Change[]) : [];
    } catch {
      return [];
    }
  }

  private write(): void {
    try {
      localStorage?.setItem(this.key, JSON.stringify(this.mem));
    } catch {
      /* sin persistencia: queda solo en memoria */
    }
  }

  enqueue(change: Change): void {
    this.mem.push(change);
    this.write();
  }

  pending(): Change[] {
    return [...this.mem];
  }

  count(): number {
    return this.mem.length;
  }

  /** Quita de la cola los cambios que el servidor confirmó. */
  markSynced(ids: readonly string[]): void {
    const done = new Set(ids);
    this.mem = this.mem.filter((c) => !done.has(c.id));
    this.write();
  }

  clear(): void {
    this.mem = [];
    this.write();
  }
}
