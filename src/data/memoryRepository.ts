/**
 * Implementación en memoria del puerto {@link Repository}. No persiste: sirve
 * como implementación de referencia del contrato y como doble para tests. Que
 * exista una segunda implementación es la prueba de que la app no está atada a
 * IndexedDB: el store funciona igual contra cualquiera de las dos.
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

const byNombre = <T extends { nombre: string }>(a: T, b: T) => a.nombre.localeCompare(b.nombre);

export class MemoryRepository implements Repository {
  private projects = new Map<string, Project>();
  private workPackages = new Map<string, WorkPackage>();
  private progress = new Map<string, ProgressEntry>();
  private baselines = new Map<string, Baseline>();
  private users = new Map<string, User>();
  private audit: AuditEntry[] = [];

  // ── Proyectos ──────────────────────────────────────────────────────────────
  async listProjects(): Promise<Project[]> {
    return [...this.projects.values()].sort(byNombre);
  }
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }
  async putProject(project: Project): Promise<void> {
    this.projects.set(project.id, project);
  }
  async deleteProject(id: string): Promise<void> {
    const wpIds = [...this.workPackages.values()].filter((w) => w.projectId === id).map((w) => w.id);
    for (const [pid, e] of this.progress) if (wpIds.includes(e.workPackageId)) this.progress.delete(pid);
    for (const wid of wpIds) this.workPackages.delete(wid);
    this.projects.delete(id);
  }

  // ── Paquetes de trabajo ──────────────────────────────────────────────────────
  async listWorkPackages(projectId: string): Promise<WorkPackage[]> {
    return [...this.workPackages.values()].filter((w) => w.projectId === projectId);
  }
  async putWorkPackage(wp: WorkPackage): Promise<void> {
    this.workPackages.set(wp.id, wp);
  }
  async bulkPutWorkPackages(wps: WorkPackage[]): Promise<void> {
    for (const wp of wps) this.workPackages.set(wp.id, wp);
  }
  async deleteWorkPackage(id: string): Promise<void> {
    for (const [pid, e] of this.progress) if (e.workPackageId === id) this.progress.delete(pid);
    this.workPackages.delete(id);
  }

  // ── Cortes de avance ─────────────────────────────────────────────────────────
  async listProgressForProject(projectId: string): Promise<ProgressEntry[]> {
    const wpIds = new Set(
      [...this.workPackages.values()].filter((w) => w.projectId === projectId).map((w) => w.id)
    );
    return [...this.progress.values()].filter((e) => wpIds.has(e.workPackageId));
  }
  async putProgressEntry(entry: ProgressEntry): Promise<void> {
    this.progress.set(entry.id, entry);
  }
  async bulkPutProgress(entries: ProgressEntry[]): Promise<void> {
    for (const e of entries) this.progress.set(e.id, e);
  }
  async deleteProgressEntry(id: string): Promise<void> {
    this.progress.delete(id);
  }

  // ── Líneas base ──────────────────────────────────────────────────────────────
  async listBaselines(projectId: string): Promise<Baseline[]> {
    return [...this.baselines.values()]
      .filter((b) => b.projectId === projectId)
      .sort((a, b) => a.version - b.version);
  }
  async freezeBaseline(baseline: Baseline): Promise<void> {
    for (const b of this.baselines.values()) {
      if (b.projectId === baseline.projectId && b.activa) this.baselines.set(b.id, { ...b, activa: false });
    }
    this.baselines.set(baseline.id, baseline);
  }
  async deleteBaseline(id: string): Promise<void> {
    this.baselines.delete(id);
  }

  // ── Usuarios y auditoría ─────────────────────────────────────────────────────
  async listUsers(): Promise<User[]> {
    return [...this.users.values()].sort(byNombre);
  }
  async putUser(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
  async bulkPutUsers(users: User[]): Promise<void> {
    for (const u of users) this.users.set(u.id, u);
  }
  async appendAudit(entry: AuditEntry): Promise<void> {
    this.audit.push(entry);
  }
  async listAudit(projectId: string): Promise<AuditEntry[]> {
    return this.audit
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  }

  // ── Utilidades / bootstrap ───────────────────────────────────────────────────
  async countProjects(): Promise<number> {
    return this.projects.size;
  }
  async countUsers(): Promise<number> {
    return this.users.size;
  }
  async bulkInsert(
    projects: Project[],
    workPackages: WorkPackage[],
    progressEntries: ProgressEntry[],
    baselines: Baseline[] = []
  ): Promise<void> {
    for (const p of projects) this.projects.set(p.id, p);
    for (const w of workPackages) this.workPackages.set(w.id, w);
    for (const e of progressEntries) this.progress.set(e.id, e);
    for (const b of baselines) this.baselines.set(b.id, b);
  }
}
