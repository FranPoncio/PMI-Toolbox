/**
 * Decorador de {@link Repository} que agrega sincronización: delega toda lectura
 * y escritura al repositorio base (local), y además registra cada **mutación de
 * usuario** como un {@link Change} en la cola, disparando un push al servidor.
 *
 * El bootstrap (bulkInsert del seed, alta masiva de usuarios de ejemplo) pasa
 * derecho sin registrarse: son datos locales, no cambios a propagar.
 */

import type {
  AuditEntry,
  Baseline,
  ProgressEntry,
  Project,
  User,
  WorkPackage,
} from '../core/types';
import type { Repository } from './repository';
import type { ChangeQueue, SyncAdapter, SyncEntity, SyncOp } from './sync';

export class SyncingRepository implements Repository {
  constructor(
    private readonly base: Repository,
    private readonly queue: ChangeQueue,
    private readonly adapter: SyncAdapter,
    private readonly newChangeId: () => string
  ) {}

  /** Registra una mutación y dispara el push (sin bloquear al usuario). */
  private track(entity: SyncEntity, op: SyncOp, ref: string | string[]): void {
    this.queue.enqueue({ id: this.newChangeId(), ts: new Date().toISOString(), entity, op, ref });
    void this.flush();
  }

  /** Empuja los cambios pendientes; si falla (offline), quedan encolados. */
  async flush(): Promise<void> {
    const pending = this.queue.pending();
    if (pending.length === 0) return;
    try {
      const { acceptedIds } = await this.adapter.push(pending);
      this.queue.markSynced(acceptedIds);
    } catch {
      /* sin conexión: los cambios siguen en la cola para reintentar */
    }
  }

  /** Cantidad de cambios locales aún no confirmados por el servidor. */
  pendingChangeCount(): number {
    return this.queue.count();
  }

  // ── Lecturas: passthrough ────────────────────────────────────────────────────
  listProjects(): Promise<Project[]> {
    return this.base.listProjects();
  }
  getProject(id: string): Promise<Project | undefined> {
    return this.base.getProject(id);
  }
  listWorkPackages(projectId: string): Promise<WorkPackage[]> {
    return this.base.listWorkPackages(projectId);
  }
  listProgressForProject(projectId: string): Promise<ProgressEntry[]> {
    return this.base.listProgressForProject(projectId);
  }
  listBaselines(projectId: string): Promise<Baseline[]> {
    return this.base.listBaselines(projectId);
  }
  listUsers(): Promise<User[]> {
    return this.base.listUsers();
  }
  listAudit(projectId: string): Promise<AuditEntry[]> {
    return this.base.listAudit(projectId);
  }
  countProjects(): Promise<number> {
    return this.base.countProjects();
  }
  countUsers(): Promise<number> {
    return this.base.countUsers();
  }

  // ── Mutaciones: base + registro de cambio ────────────────────────────────────
  async putProject(project: Project): Promise<void> {
    await this.base.putProject(project);
    this.track('project', 'put', project.id);
  }
  async deleteProject(id: string): Promise<void> {
    await this.base.deleteProject(id);
    this.track('project', 'delete', id);
  }
  async putWorkPackage(wp: WorkPackage): Promise<void> {
    await this.base.putWorkPackage(wp);
    this.track('workPackage', 'put', wp.id);
  }
  async bulkPutWorkPackages(wps: WorkPackage[]): Promise<void> {
    await this.base.bulkPutWorkPackages(wps);
    this.track('workPackage', 'bulkPut', wps.map((w) => w.id));
  }
  async deleteWorkPackage(id: string): Promise<void> {
    await this.base.deleteWorkPackage(id);
    this.track('workPackage', 'delete', id);
  }
  async putProgressEntry(entry: ProgressEntry): Promise<void> {
    await this.base.putProgressEntry(entry);
    this.track('progress', 'put', entry.id);
  }
  async bulkPutProgress(entries: ProgressEntry[]): Promise<void> {
    await this.base.bulkPutProgress(entries);
    this.track('progress', 'bulkPut', entries.map((e) => e.id));
  }
  async deleteProgressEntry(id: string): Promise<void> {
    await this.base.deleteProgressEntry(id);
    this.track('progress', 'delete', id);
  }
  async freezeBaseline(baseline: Baseline): Promise<void> {
    await this.base.freezeBaseline(baseline);
    this.track('baseline', 'put', baseline.id);
  }
  async deleteBaseline(id: string): Promise<void> {
    await this.base.deleteBaseline(id);
    this.track('baseline', 'delete', id);
  }
  async putUser(user: User): Promise<void> {
    await this.base.putUser(user);
    this.track('user', 'put', user.id);
  }
  async appendAudit(entry: AuditEntry): Promise<void> {
    await this.base.appendAudit(entry);
    this.track('audit', 'put', entry.id);
  }

  // ── Bootstrap: passthrough SIN registrar (datos locales de arranque) ─────────
  bulkPutUsers(users: User[]): Promise<void> {
    return this.base.bulkPutUsers(users);
  }
  bulkInsert(
    projects: Project[],
    workPackages: WorkPackage[],
    progressEntries: ProgressEntry[],
    baselines: Baseline[] = []
  ): Promise<void> {
    return this.base.bulkInsert(projects, workPackages, progressEntries, baselines);
  }
}
