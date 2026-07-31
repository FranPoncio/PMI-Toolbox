/**
 * Import de cronograma: mapea un CSV (exportado de Excel / MS Project / P6) a
 * borradores de paquetes de trabajo, con detección de columnas por encabezado y
 * validación fila por fila. La lógica de parsing pura vive en `core/csv.ts`.
 */

import { parseCsv, parseLocaleDate, parseLocaleNumber } from '../core/csv';
import type { WorkPackage } from '../core/types';

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
