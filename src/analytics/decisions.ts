/**
 * Análisis derivado para la maqueta: convierte proyecto + paquetes + avances
 * en (a) un resultado EVM por paquete y consolidado, y (b) la lista de ítems
 * que "requieren decisión", ordenada por exposición económica y con el motivo
 * explícito de cada uno.
 *
 * Es lógica pura (sin React). Usa el motor de `core/evm.ts` como única fuente
 * de verdad de los indicadores.
 */

import {
  actualCost,
  budgetAtCompletion,
  computeEvm,
  earnedValue,
  plannedFraction,
  plannedValue,
  sCurve,
} from '../core/evm';
import type { EvmInputs, EvmResult, ProgressEntry, Project, WorkPackage } from '../core/types';
import { classifyIndex, worstStatus, type Status } from './status';

export interface WorkPackageAnalysis {
  wp: WorkPackage;
  inputs: EvmInputs;
  evm: EvmResult;
  spiStatus: Status;
  cpiStatus: Status;
  /** Estado general del paquete (el más severo entre SPI y CPI). */
  status: Status;
  /**
   * Exposición económica: sobrecosto proyectado a fin de paquete, en la moneda
   * del proyecto. Usa el EAC por CPI (desvío sistémico). 0 si no proyecta
   * sobrecosto o si no hay datos de costo todavía.
   */
  exposicion: number;
  /** ¿El paquete ya arrancó a la fecha de corte? (PV > 0). */
  iniciado: boolean;
}

export interface DecisionItem {
  wpId: string;
  wpNombre: string;
  responsable: string;
  status: Status;
  exposicion: number;
  /** Motivo explícito, en prosa, de por qué el ítem requiere decisión. */
  motivo: string;
}

export interface ProjectAnalysis {
  project: Project;
  /** EVM consolidado del proyecto (suma de curvas de los paquetes). */
  evm: EvmResult;
  status: Status;
  packages: WorkPackageAnalysis[];
  /** Ítems que requieren decisión, ordenados por exposición descendente. */
  decisiones: DecisionItem[];
}

/** Construye los insumos EVM de un paquete a la fecha de corte. */
function inputsForWp(
  wp: WorkPackage,
  progress: ProgressEntry | undefined,
  dataDate: string
): EvmInputs {
  return {
    pv: wp.presupuesto * plannedFraction(wp, dataDate, sCurve),
    ev: wp.presupuesto * (progress?.avanceFisico ?? 0),
    ac: progress?.costoRealAcum ?? 0,
    bac: wp.presupuesto,
  };
}

/** Sobrecosto proyectado (positivo) a partir del VAC por CPI. */
function exposicionDe(evm: EvmResult): number {
  const vac = evm.vac.cpi;
  if (vac === null) return 0;
  return vac < 0 ? -vac : 0;
}

function analyzeWp(
  wp: WorkPackage,
  progress: ProgressEntry | undefined,
  dataDate: string
): WorkPackageAnalysis {
  const inputs = inputsForWp(wp, progress, dataDate);
  const evm = computeEvm(inputs);
  const spiStatus = classifyIndex(evm.spi);
  const cpiStatus = classifyIndex(evm.cpi);
  return {
    wp,
    inputs,
    evm,
    spiStatus,
    cpiStatus,
    status: worstStatus(spiStatus, cpiStatus),
    exposicion: exposicionDe(evm),
    iniciado: inputs.pv > 0,
  };
}

/** Redacta el motivo de decisión de un paquete a partir de su análisis. */
function motivoDe(a: WorkPackageAnalysis, currency: string): string {
  const partes: string[] = [];
  const { evm } = a;

  if (a.cpiStatus === 'desvio' || a.cpiStatus === 'atencion') {
    const cpi = evm.cpi?.toFixed(2) ?? '—';
    const eac = evm.eac.cpi;
    if (eac !== null) {
      partes.push(
        `CPI ${cpi}: a este ritmo cierra en ${money(eac, currency)} contra ${money(a.inputs.bac, currency)} de presupuesto (VAC ${signedMoney(evm.vac.cpi, currency)})`
      );
    } else {
      partes.push(`CPI ${cpi}: costo por encima de lo ganado`);
    }
  }

  if (a.spiStatus === 'desvio' || a.spiStatus === 'atencion') {
    const spi = evm.spi?.toFixed(2) ?? '—';
    partes.push(
      `SPI ${spi}: ejecutado ${money(a.inputs.ev, currency)} contra ${money(a.inputs.pv, currency)} planificado a la fecha (SV ${signedMoney(evm.sv, currency)})`
    );
  }

  return partes.join('. ') + '.';
}

// Formateadores mínimos e internos (la UI tiene los suyos; acá el motivo es texto puro).
function money(value: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
function signedMoney(value: number | null, currency: string): string {
  if (value === null) return '—';
  const s = money(Math.abs(value), currency);
  return value < 0 ? `−${s}` : `+${s}`;
}

/** Analiza el proyecto completo: consolidado + por paquete + decisiones. */
export function analyzeProject(
  project: Project,
  workPackages: readonly WorkPackage[],
  progressByWp: ReadonlyMap<string, ProgressEntry>,
  dataDate: string
): ProjectAnalysis {
  const packages = workPackages.map((wp) => analyzeWp(wp, progressByWp.get(wp.id), dataDate));

  // Consolidado: sumamos las curvas de todos los paquetes.
  const consolidated: EvmInputs = {
    pv: plannedValue(workPackages, dataDate, sCurve),
    ev: earnedValue(workPackages, progressByWp),
    ac: actualCost(workPackages, progressByWp),
    bac: budgetAtCompletion(workPackages),
  };
  const evm = computeEvm(consolidated);

  const decisiones: DecisionItem[] = packages
    .filter((a) => a.status === 'desvio' || a.status === 'atencion')
    .sort((x, y) => y.exposicion - x.exposicion)
    .map((a) => ({
      wpId: a.wp.id,
      wpNombre: a.wp.nombre,
      responsable: a.wp.responsable,
      status: a.status,
      exposicion: a.exposicion,
      motivo: motivoDe(a, project.moneda),
    }));

  return {
    project,
    evm,
    status: worstStatus(classifyIndex(evm.spi), classifyIndex(evm.cpi)),
    packages,
    decisiones,
  };
}
