import type { ProgressEntry, Project, WorkPackage } from '../core/types';

/**
 * Datos de ejemplo para la maqueta: un tramo de gasoducto con planta
 * compresora. Los números están armados para contar una historia realista —
 * la obra viene atrasada y con sobrecosto, empujada por el tendido del ducto —
 * y así ejercitar el panel "requiere decisión".
 *
 * Nada de esto se persiste todavía; es el seed que después migra a Dexie.
 */

/** Fecha de corte del tablero (data date). */
export const DATA_DATE = '2026-07-30';

export const project: Project = {
  id: 'gc3',
  nombre: 'Gasoducto Regional Norte — Tramo Compresión GC-3',
  tipo: 'obra_civil',
  bac: 23_200_000,
  fechaInicio: '2025-09-01',
  fechaFinPlan: '2027-03-31',
  moneda: 'USD',
};

export const workPackages: WorkPackage[] = [
  {
    id: 'wp-ing',
    projectId: 'gc3',
    nombre: 'Ingeniería de detalle',
    presupuesto: 850_000,
    peso: 3.7,
    fechaInicioPlan: '2025-09-01',
    fechaFinPlan: '2026-03-31',
    responsable: 'M. Alcaraz',
  },
  {
    id: 'wp-adq',
    projectId: 'gc3',
    nombre: 'Adquisición de cañería y válvulas',
    presupuesto: 4_200_000,
    peso: 18.1,
    fechaInicioPlan: '2025-11-01',
    fechaFinPlan: '2026-09-30',
    responsable: 'S. Duarte',
  },
  {
    id: 'wp-civ',
    projectId: 'gc3',
    nombre: 'Obras civiles planta compresora',
    presupuesto: 3_100_000,
    peso: 13.4,
    fechaInicioPlan: '2026-01-15',
    fechaFinPlan: '2026-12-15',
    responsable: 'R. Ibáñez',
  },
  {
    id: 'wp-duc',
    projectId: 'gc3',
    nombre: 'Tendido y soldadura de ducto',
    presupuesto: 6_800_000,
    peso: 29.3,
    fechaInicioPlan: '2026-03-01',
    fechaFinPlan: '2026-12-31',
    responsable: 'J. Molina',
  },
  {
    id: 'wp-mon',
    projectId: 'gc3',
    nombre: 'Montaje electromecánico',
    presupuesto: 5_400_000,
    peso: 23.3,
    fechaInicioPlan: '2026-05-01',
    fechaFinPlan: '2027-01-31',
    responsable: 'L. Ferreyra',
  },
  {
    id: 'wp-scada',
    projectId: 'gc3',
    nombre: 'Instrumentación y SCADA',
    presupuesto: 1_650_000,
    peso: 7.1,
    fechaInicioPlan: '2026-08-01',
    fechaFinPlan: '2027-02-28',
    responsable: 'P. Sosa',
  },
  {
    id: 'wp-pru',
    projectId: 'gc3',
    nombre: 'Pruebas, precomisionado y habilitación',
    presupuesto: 1_200_000,
    peso: 5.2,
    fechaInicioPlan: '2026-11-01',
    fechaFinPlan: '2027-03-31',
    responsable: 'C. Vega',
  },
];

/**
 * Estado final de cada paquete a la fecha de corte (avance físico y costo real
 * acumulado). Es la "foto" del último corte; el seed genera la historia de
 * cortes anteriores rampeando hacia estos valores.
 * Los paquetes que aún no arrancaron (scada, pruebas) no figuran → avance 0.
 */
export const finalProgress: ReadonlyArray<{
  wpId: string;
  avanceFisico: number;
  costoRealAcum: number;
}> = [
  { wpId: 'wp-ing', avanceFisico: 1.0, costoRealAcum: 910_000 }, // terminado, sobrecosto leve
  { wpId: 'wp-adq', avanceFisico: 0.78, costoRealAcum: 3_150_000 }, // en plan
  { wpId: 'wp-civ', avanceFisico: 0.42, costoRealAcum: 1_650_000 }, // sobrecosto
  { wpId: 'wp-duc', avanceFisico: 0.35, costoRealAcum: 2_950_000 }, // atrasado y con sobrecosto
  { wpId: 'wp-mon', avanceFisico: 0.12, costoRealAcum: 780_000 }, // recién arranca
];

/** Avance vigente por paquete a la fecha de corte (foto final). */
export const progressByWp: ReadonlyMap<string, ProgressEntry> = new Map(
  finalProgress.map((p) => [
    p.wpId,
    {
      id: `${p.wpId}-pe`,
      workPackageId: p.wpId,
      fechaCorte: DATA_DATE,
      avanceFisico: p.avanceFisico,
      costoRealAcum: p.costoRealAcum,
    } satisfies ProgressEntry,
  ])
);
