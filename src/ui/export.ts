/**
 * Exportación del corte actual a CSV. Es el entregable del analista: una
 * planilla con el consolidado, el pronóstico de plazo y el detalle por paquete,
 * lista para adjuntar a un informe o abrir en Excel.
 *
 * Todo client-side (Blob + descarga), sin dependencias.
 */

import type { Status } from '../analytics/status';
import type { ProjectView } from '../store/selectors';

const STATUS_LABEL: Record<Status, string> = {
  onplan: 'Dentro de plan',
  atencion: 'Atención',
  desvio: 'Desvío',
  'sin-dato': 'Sin datos',
};

/** Escapa un campo CSV (comillas dobles + envoltura si hace falta). */
function cell(value: string | number | null): string {
  if (value === null) return '';
  const s = typeof value === 'number' ? String(value) : value;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function round(n: number | null): number | null {
  return n === null ? null : Math.round(n);
}

function num(n: number | null, digits = 2): number | null {
  return n === null ? null : Number(n.toFixed(digits));
}

/** Construye el contenido CSV del corte actual. */
export function buildCsv(view: ProjectView): string {
  const { project, analysis, forecast, dataDate } = view;
  const rows: Array<Array<string | number | null>> = [];

  rows.push(['PMI Toolbox — Reporte EVM']);
  rows.push(['Proyecto', project.nombre]);
  rows.push(['Tipo', project.tipo]);
  rows.push(['Moneda', project.moneda]);
  rows.push(['Fecha de corte', dataDate]);
  rows.push(['BAC', round(analysis.evm.bac)]);
  rows.push([]);

  rows.push(['Consolidado']);
  rows.push(['PV', 'EV', 'AC', 'SV', 'CV', 'SPI', 'CPI', 'EAC (CPI)', 'VAC (CPI)', 'TCPI (BAC)']);
  rows.push([
    round(analysis.evm.pv),
    round(analysis.evm.ev),
    round(analysis.evm.ac),
    round(analysis.evm.sv),
    round(analysis.evm.cv),
    num(analysis.evm.spi),
    num(analysis.evm.cpi),
    round(analysis.evm.eac.cpi),
    round(analysis.evm.vac.cpi),
    num(analysis.evm.tcpiBac),
  ]);
  rows.push([]);

  rows.push(['Pronóstico de plazo (Earned Schedule)']);
  rows.push(['Fin planificado', 'Fin pronosticado', 'Atraso (meses)', 'SPI(t)', 'SV(t) meses']);
  rows.push([
    forecast.fechaFinPlan,
    forecast.fechaFinPronosticada,
    num(forecast.atrasoMeses, 1),
    num(forecast.spit),
    num(forecast.svtMonths, 1),
  ]);
  rows.push([]);

  rows.push(['Detalle por paquete']);
  rows.push([
    'Paquete',
    'Responsable',
    'Presupuesto',
    'PV',
    'EV',
    'AC',
    'SV',
    'CV',
    'SPI',
    'CPI',
    'EAC (CPI)',
    'VAC (CPI)',
    'Estado',
  ]);
  for (const a of analysis.packages) {
    rows.push([
      a.wp.nombre,
      a.wp.responsable,
      round(a.inputs.bac),
      round(a.inputs.pv),
      round(a.inputs.ev),
      round(a.inputs.ac),
      round(a.evm.sv),
      round(a.evm.cv),
      num(a.evm.spi),
      num(a.evm.cpi),
      round(a.evm.eac.cpi),
      round(a.evm.vac.cpi),
      STATUS_LABEL[a.status],
    ]);
  }

  return rows.map((r) => r.map(cell).join(',')).join('\n');
}

/** Dispara la descarga de un CSV (con BOM para acentos en Excel). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
