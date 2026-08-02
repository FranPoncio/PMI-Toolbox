/**
 * Seed inicial: si la base está vacía, carga el proyecto de ejemplo con una
 * historia de cortes (no una sola foto), para que la curva S muestre la
 * evolución real de EV y AC en el tiempo.
 */

import type { AuditEntry, Baseline, ProgressEntry, User } from '../core/types';
import { buildBaselineSnapshot } from '../analytics/baseline';
import {
  DATA_DATE,
  finalProgress,
  project,
  workPackages,
} from '../fixtures/gasoducto';
import { newId } from './db';
import { baseRepo } from '../data';

/** Usuarios de ejemplo. */
const SEED_USERS: User[] = [
  { id: 'u-alcaraz', nombre: 'M. Alcaraz', rol: 'jefe_proyecto' },
  { id: 'u-duarte', nombre: 'S. Duarte', rol: 'analista' },
  { id: 'u-sosa', nombre: 'P. Sosa', rol: 'analista' },
  { id: 'u-vega', nombre: 'C. Vega', rol: 'auditor' },
];

/** Siembra los usuarios si no hay ninguno. Devuelve la lista vigente. */
export async function seedUsersIfEmpty(): Promise<User[]> {
  if ((await baseRepo.countUsers()) === 0) {
    await baseRepo.bulkPutUsers(SEED_USERS);
  }
  return baseRepo.listUsers();
}

/** Fechas de corte del ejemplo (mensuales) hasta la fecha de corte final. */
const CUT_DATES = [
  '2026-02-28',
  '2026-03-31',
  '2026-04-30',
  '2026-05-31',
  '2026-06-30',
  DATA_DATE,
];

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Genera los cortes de un paquete rampeando avance y costo hacia sus valores
 * finales. El costo acompaña proporcionalmente al avance, así el CPI se
 * mantiene coherente entre cortes.
 */
function buildHistory(): ProgressEntry[] {
  const finalByWp = new Map(finalProgress.map((p) => [p.wpId, p]));
  const finalMs = Date.parse(DATA_DATE);
  const entries: ProgressEntry[] = [];

  for (const wp of workPackages) {
    const target = finalByWp.get(wp.id);
    if (!target || target.avanceFisico === 0) continue; // aún no arrancó

    const startMs = Date.parse(wp.fechaInicioPlan);
    for (const date of CUT_DATES) {
      const d = Date.parse(date);
      if (d < startMs) continue; // el paquete no había arrancado en esa fecha
      const ramp = clamp01((d - startMs) / (finalMs - startMs || 1));
      entries.push({
        id: `${wp.id}-${date}`,
        workPackageId: wp.id,
        fechaCorte: date,
        avanceFisico: Number((target.avanceFisico * ramp).toFixed(4)),
        costoRealAcum: Math.round(target.costoRealAcum * ramp),
      });
    }
  }
  return entries;
}

/** Carga el ejemplo sólo si no hay proyectos. Devuelve true si sembró. */
export async function seedIfEmpty(): Promise<boolean> {
  if ((await baseRepo.countProjects()) > 0) return false;

  // Línea base v1 aprobada al inicio del proyecto.
  const baseline: Baseline = {
    ...buildBaselineSnapshot(
      project,
      workPackages,
      1,
      project.fechaInicio,
      'Línea base inicial aprobada'
    ),
    id: newId(),
  };

  await baseRepo.bulkInsert([project], [...workPackages], buildHistory(), [baseline]);
  await seedAudit(baseline);
  return true;
}

/** Bitácora inicial retroactiva, para que el ejemplo tenga historia real. */
async function seedAudit(baseline: Baseline): Promise<void> {
  const bacFmt = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: project.moneda,
    maximumFractionDigits: 0,
  }).format(project.bac);

  const jefe = SEED_USERS[0]!; // M. Alcaraz
  const analistas = [SEED_USERS[1]!, SEED_USERS[2]!]; // Duarte, Sosa

  const entries: AuditEntry[] = [];
  const push = (ts: string, user: User, action: AuditEntry['action'], entity: AuditEntry['entity'], resumen: string) =>
    entries.push({
      id: newId(),
      ts,
      projectId: project.id,
      userId: user.id,
      userNombre: user.nombre,
      userRol: user.rol,
      action,
      entity,
      resumen,
    });

  push(`${project.fechaInicio}T09:00:00.000Z`, jefe, 'crear', 'proyecto', `Creó el proyecto «${project.nombre}»`);
  push(
    `${baseline.fechaAprobacion}T15:30:00.000Z`,
    jefe,
    'congelar',
    'linea_base',
    `Congeló la línea base v${baseline.version} (BAC ${bacFmt})`
  );
  CUT_DATES.forEach((date, i) => {
    const u = analistas[i % analistas.length]!;
    push(`${date}T18:00:00.000Z`, u, 'importar', 'corte', `Cargó el corte ${date}`);
  });

  for (const e of entries) await baseRepo.appendAudit(e);
}
