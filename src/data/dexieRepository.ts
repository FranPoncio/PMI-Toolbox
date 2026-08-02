/**
 * Implementación del puerto {@link Repository} sobre IndexedDB (Dexie).
 * Encapsula todo el conocimiento de Dexie; el resto de la app no lo ve.
 */

import type {
  AuditEntry,
  Baseline,
  ProgressEntry,
  Project,
  User,
  WorkPackage,
} from '../core/types';
import type { PmToolDB } from '../db/db';
import type { Repository } from './repository';

export class DexieRepository implements Repository {
  constructor(private readonly db: PmToolDB) {}

  // ── Proyectos ──────────────────────────────────────────────────────────────
  listProjects(): Promise<Project[]> {
    return this.db.projects.orderBy('nombre').toArray();
  }
  getProject(id: string): Promise<Project | undefined> {
    return this.db.projects.get(id);
  }
  async putProject(project: Project): Promise<void> {
    await this.db.projects.put(project);
  }
  /** Borra un proyecto y todo lo colgado de él (paquetes y cortes). */
  async deleteProject(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.projects, this.db.workPackages, this.db.progressEntries, async () => {
      const wps = await this.db.workPackages.where('projectId').equals(id).toArray();
      const wpIds = wps.map((w) => w.id);
      await this.db.progressEntries.where('workPackageId').anyOf(wpIds).delete();
      await this.db.workPackages.where('projectId').equals(id).delete();
      await this.db.projects.delete(id);
    });
  }

  // ── Paquetes de trabajo ──────────────────────────────────────────────────────
  listWorkPackages(projectId: string): Promise<WorkPackage[]> {
    return this.db.workPackages.where('projectId').equals(projectId).toArray();
  }
  async putWorkPackage(wp: WorkPackage): Promise<void> {
    await this.db.workPackages.put(wp);
  }
  async bulkPutWorkPackages(wps: WorkPackage[]): Promise<void> {
    await this.db.workPackages.bulkPut(wps);
  }
  /** Borra un paquete y sus cortes de avance. */
  async deleteWorkPackage(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.workPackages, this.db.progressEntries, async () => {
      await this.db.progressEntries.where('workPackageId').equals(id).delete();
      await this.db.workPackages.delete(id);
    });
  }

  // ── Cortes de avance ─────────────────────────────────────────────────────────
  async listProgressForProject(projectId: string): Promise<ProgressEntry[]> {
    const wps = await this.db.workPackages.where('projectId').equals(projectId).toArray();
    const wpIds = wps.map((w) => w.id);
    if (wpIds.length === 0) return [];
    return this.db.progressEntries.where('workPackageId').anyOf(wpIds).toArray();
  }
  async putProgressEntry(entry: ProgressEntry): Promise<void> {
    await this.db.progressEntries.put(entry);
  }
  async bulkPutProgress(entries: ProgressEntry[]): Promise<void> {
    await this.db.progressEntries.bulkPut(entries);
  }
  async deleteProgressEntry(id: string): Promise<void> {
    await this.db.progressEntries.delete(id);
  }

  // ── Líneas base ──────────────────────────────────────────────────────────────
  async listBaselines(projectId: string): Promise<Baseline[]> {
    const list = await this.db.baselines.where('projectId').equals(projectId).toArray();
    return list.sort((a, b) => a.version - b.version);
  }
  /** Congela una nueva línea base: la marca activa y desactiva las demás. */
  async freezeBaseline(baseline: Baseline): Promise<void> {
    await this.db.transaction('rw', this.db.baselines, async () => {
      const previas = await this.db.baselines.where('projectId').equals(baseline.projectId).toArray();
      for (const b of previas) {
        if (b.activa) await this.db.baselines.update(b.id, { activa: false });
      }
      await this.db.baselines.put(baseline);
    });
  }
  async deleteBaseline(id: string): Promise<void> {
    await this.db.baselines.delete(id);
  }

  // ── Usuarios y auditoría ─────────────────────────────────────────────────────
  listUsers(): Promise<User[]> {
    return this.db.users.orderBy('nombre').toArray();
  }
  async putUser(user: User): Promise<void> {
    await this.db.users.put(user);
  }
  async bulkPutUsers(users: User[]): Promise<void> {
    await this.db.users.bulkPut(users);
  }
  /** Agrega una entrada de bitácora (inmutable: solo se agrega). */
  async appendAudit(entry: AuditEntry): Promise<void> {
    await this.db.audit.add(entry);
  }
  /** Bitácora de un proyecto, más reciente primero. */
  async listAudit(projectId: string): Promise<AuditEntry[]> {
    const list = await this.db.audit.where('projectId').equals(projectId).toArray();
    return list.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  }

  // ── Utilidades / bootstrap ───────────────────────────────────────────────────
  countProjects(): Promise<number> {
    return this.db.projects.count();
  }
  countUsers(): Promise<number> {
    return this.db.users.count();
  }
  async bulkInsert(
    projects: Project[],
    workPackages: WorkPackage[],
    progressEntries: ProgressEntry[],
    baselines: Baseline[] = []
  ): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.projects,
      this.db.workPackages,
      this.db.progressEntries,
      this.db.baselines,
      async () => {
        await this.db.projects.bulkPut(projects);
        await this.db.workPackages.bulkPut(workPackages);
        await this.db.progressEntries.bulkPut(progressEntries);
        await this.db.baselines.bulkPut(baselines);
      }
    );
  }
}
