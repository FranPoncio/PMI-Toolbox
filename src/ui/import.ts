/**
 * Import de cronograma: mapea un CSV (exportado de Excel / MS Project / P6) a
 * borradores de paquetes de trabajo, con detección de columnas por encabezado y
 * validación fila por fila. La lógica de parsing pura vive en `core/csv.ts`.
 */

import { parseCsv, parseLocaleDate, parseLocaleNumber } from '../core/csv';
import type { ProgressEntry, WorkPackage } from '../core/types';

export type WorkPackageDraft = Omit<WorkPackage, 'id' | 'projectId'>;

export interface ImportRow {
  draft: WorkPackageDraft | null;
  errores: string[];
  raw: string[];
}

export interface ImportResult {
  rows: ImportRow[];
  /** Índice de columna detectado por campo (−1 si no se encontró). */
  columnas: Record<Campo, number>;
  /** Error que impide importar del todo (ej.: no se reconocieron columnas). */
  errorGeneral?: string;
  /** Cantidad de filas válidas (sin errores). */
  validas: number;
}

type Campo = 'nombre' | 'presupuesto' | 'peso' | 'inicio' | 'fin' | 'responsable';

const ALIASES: Record<Campo, string[]> = {
  nombre: ['nombre', 'paquete', 'tarea', 'task', 'name', 'actividad', 'wbs'],
  presupuesto: ['presupuesto', 'budget', 'bac', 'costo', 'monto', 'importe'],
  peso: ['peso', 'weight', 'ponderacion'],
  inicio: ['inicio', 'fechainicio', 'fechainicioplan', 'start', 'comienzo', 'inicioplan'],
  fin: ['fin', 'fechafin', 'fechafinplan', 'finish', 'end', 'terminacion', 'finplan'],
  responsable: ['responsable', 'responsible', 'owner', 'encargado'],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]/g, '');
}

function detectColumns(header: string[]): Record<Campo, number> {
  const norm = header.map(normalize);
  const cols = {} as Record<Campo, number>;
  for (const campo of Object.keys(ALIASES) as Campo[]) {
    cols[campo] = norm.findIndex((h) => ALIASES[campo].includes(h));
  }
  return cols;
}

/** Parsea el texto CSV a filas de import con validación. */
export function parseSchedule(text: string): ImportResult {
  const rows = parseCsv(text);
  const empty: ImportResult = { rows: [], columnas: {} as Record<Campo, number>, validas: 0 };

  if (rows.length < 2) {
    return { ...empty, errorGeneral: 'El archivo no tiene encabezado y al menos una fila de datos.' };
  }

  const columnas = detectColumns(rows[0]!);
  if (columnas.nombre < 0 || columnas.presupuesto < 0 || columnas.inicio < 0 || columnas.fin < 0) {
    return {
      ...empty,
      columnas,
      errorGeneral:
        'No se reconocieron las columnas mínimas (nombre, presupuesto, inicio, fin). Revisá el encabezado.',
    };
  }

  const out: ImportRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i]!;
    const errores: string[] = [];
    const cell = (c: Campo) => (columnas[c] >= 0 ? (raw[columnas[c]] ?? '') : '');

    const nombre = cell('nombre').trim();
    if (nombre === '') errores.push('nombre vacío');

    const presupuesto = parseLocaleNumber(cell('presupuesto'));
    if (presupuesto === null || presupuesto <= 0) errores.push('presupuesto inválido');

    const inicio = parseLocaleDate(cell('inicio'));
    if (inicio === null) errores.push('fecha de inicio inválida');

    const fin = parseLocaleDate(cell('fin'));
    if (fin === null) errores.push('fecha de fin inválida');

    if (inicio && fin && fin < inicio) errores.push('el fin es anterior al inicio');

    const pesoParsed = parseLocaleNumber(cell('peso'));
    const responsable = cell('responsable').trim();

    const draft: WorkPackageDraft | null =
      errores.length === 0 && presupuesto !== null && inicio && fin
        ? {
            nombre,
            presupuesto,
            peso: pesoParsed !== null && pesoParsed > 0 ? pesoParsed : presupuesto,
            fechaInicioPlan: inicio,
            fechaFinPlan: fin,
            responsable,
          }
        : null;

    out.push({ draft, errores, raw });
  }

  return {
    rows: out,
    columnas,
    validas: out.filter((r) => r.draft !== null).length,
  };
}

/** CSV de plantilla para descargar (encabezado + ejemplo). */
export function scheduleTemplateCsv(): string {
  return [
    'nombre,presupuesto,peso,inicio,fin,responsable',
    'Ingeniería de detalle,850000,3.7,2025-09-01,2026-03-31,M. Alcaraz',
    'Obras civiles,3100000,13.4,2026-01-15,2026-12-15,R. Ibáñez',
  ].join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Import de avances y costos reales (patrón ERP → EVM)
// Igual que Cobra/Hexagon ingieren actuals del ERP, acá se cargan en bloque los
// avances físicos y costos reales acumulados por paquete y fecha de corte.
// ────────────────────────────────────────────────────────────────────────────

export type ProgressDraft = Omit<ProgressEntry, 'id'>;

export interface ActualRow {
  draft: ProgressDraft | null;
  errores: string[];
  raw: string[];
}

export interface ActualsResult {
  rows: ActualRow[];
  columnas: Record<CampoActual, number>;
  errorGeneral?: string;
  validas: number;
}

type CampoActual = 'paquete' | 'fecha' | 'avance' | 'costo';

const ALIASES_ACTUAL: Record<CampoActual, string[]> = {
  paquete: ['paquete', 'nombre', 'tarea', 'task', 'wbs', 'actividad'],
  fecha: ['fecha', 'fechacorte', 'corte', 'date', 'periodo', 'cutoff'],
  avance: ['avance', 'avancefisico', 'avancefisicopct', 'progreso', 'progress', 'percentcomplete', 'pct'],
  costo: ['costo', 'costoreal', 'costorealacum', 'ac', 'acwp', 'actualcost', 'realacumulado'],
};

function detectActualColumns(header: string[]): Record<CampoActual, number> {
  const norm = header.map(normalize);
  const cols = {} as Record<CampoActual, number>;
  for (const campo of Object.keys(ALIASES_ACTUAL) as CampoActual[]) {
    cols[campo] = norm.findIndex((h) => ALIASES_ACTUAL[campo].includes(h));
  }
  return cols;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Parsea un CSV de avances/costos a borradores de corte. Empareja cada fila con
 * un paquete existente por nombre (normalizado). El avance se interpreta en
 * porcentaje (0..100); el costo es acumulado (ACWP).
 */
export function parseActuals(text: string, workPackages: readonly WorkPackage[]): ActualsResult {
  const rows = parseCsv(text);
  const empty: ActualsResult = {
    rows: [],
    columnas: {} as Record<CampoActual, number>,
    validas: 0,
  };
  if (rows.length < 2) {
    return { ...empty, errorGeneral: 'El archivo no tiene encabezado y al menos una fila de datos.' };
  }

  const columnas = detectActualColumns(rows[0]!);
  if (columnas.paquete < 0 || columnas.fecha < 0) {
    return {
      ...empty,
      columnas,
      errorGeneral: 'No se reconocieron las columnas mínimas (paquete, fecha). Revisá el encabezado.',
    };
  }

  const byName = new Map(workPackages.map((wp) => [normalize(wp.nombre), wp]));

  const out: ActualRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i]!;
    const errores: string[] = [];
    const cell = (c: CampoActual) => (columnas[c] >= 0 ? (raw[columnas[c]] ?? '') : '');

    const wp = byName.get(normalize(cell('paquete')));
    if (!wp) errores.push('paquete no encontrado');

    const fecha = parseLocaleDate(cell('fecha'));
    if (fecha === null) errores.push('fecha inválida');

    const avanceRaw = parseLocaleNumber(cell('avance'));
    const costoRaw = parseLocaleNumber(cell('costo'));
    if (avanceRaw === null && costoRaw === null) errores.push('sin avance ni costo');

    const draft: ProgressDraft | null =
      errores.length === 0 && wp && fecha
        ? {
            workPackageId: wp.id,
            fechaCorte: fecha,
            avanceFisico: clamp01((avanceRaw ?? 0) / 100),
            costoRealAcum: costoRaw ?? 0,
          }
        : null;

    out.push({ draft, errores, raw });
  }

  return { rows: out, columnas, validas: out.filter((r) => r.draft !== null).length };
}

/** CSV de plantilla de avances/costos. */
export function actualsTemplateCsv(): string {
  return [
    'paquete,fecha,avance,costo',
    'Ingeniería de detalle,2026-06-30,100,910000',
    'Obras civiles planta compresora,2026-06-30,42,1650000',
  ].join('\n');
}
