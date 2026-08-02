/**
 * Puerto de persistencia (arquitectura hexagonal). TODO acceso a datos de la
 * app pasa por esta interfaz: el store y la UI dependen de este contrato, no de
 * una base concreta.
 *
 * Hoy lo implementa IndexedDB en el navegador (`DexieRepository`). El día que
 * haya un backend real (REST/GraphQL, multiusuario sincronizado), será otra
 * implementación del **mismo contrato** — enchufable sin tocar el store ni la
 * UI. Esa es la razón de esta capa: dejar la app "backend-ready".
 */

import type {
  AuditEntry,
  Baseline,
  ProgressEntry,
  Project,
  User,
  WorkPackage,
} from '../core/types';

export interface Repository {
  // ── Proyectos ──────────────────────────────────────────────────────────────
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  putProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // ── Paquetes de trabajo ──────────────────────────────────────────────────────
  listWorkPackages(projectId: string): Promise<WorkPackage[]>;
  putWorkPackage(wp: WorkPackage): Promise<void>;
  bulkPutWorkPackages(wps: WorkPackage[]): Promise<void>;
  deleteWorkPackage(id: string): Promise<void>;

  // ── Cortes de avance ─────────────────────────────────────────────────────────
  listProgressForProject(projectId: string): Promise<ProgressEntry[]>;
  putProgressEntry(entry: ProgressEntry): Promise<void>;
  bulkPutProgress(entries: ProgressEntry[]): Promise<void>;
  deleteProgressEntry(id: string): Promise<void>;

  // ── Líneas base ──────────────────────────────────────────────────────────────
  listBaselines(projectId: string): Promise<Baseline[]>;
  freezeBaseline(baseline: Baseline): Promise<void>;
  deleteBaseline(id: string): Promise<void>;

  // ── Usuarios y auditoría ─────────────────────────────────────────────────────
  listUsers(): Promise<User[]>;
  putUser(user: User): Promise<void>;
  bulkPutUsers(users: User[]): Promise<void>;
  appendAudit(entry: AuditEntry): Promise<void>;
  listAudit(projectId: string): Promise<AuditEntry[]>;

  // ── Utilidades / bootstrap ───────────────────────────────────────────────────
  countProjects(): Promise<number>;
  countUsers(): Promise<number>;
  /** Carga en bloque (seed inicial). No es una mutación de usuario. */
  bulkInsert(
    projects: Project[],
    workPackages: WorkPackage[],
    progressEntries: ProgressEntry[],
    baselines?: Baseline[]
  ): Promise<void>;
}
