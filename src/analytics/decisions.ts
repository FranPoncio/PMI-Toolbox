/**
 * Análisis derivado para la maqueta: convierte proyecto + paquetes + avances
 * en (a) un resultado EVM por paquete y consolidado, y (b) la lista de ítems
 * que "requieren decisión", ordenada por exposición económica y con el motivo
 * explícito de cada uno.
 *
 * Es lógica pura (sin React). Usa el motor de `core/evm.ts` como única fuente
 * de verdad de los indicadores.
 */

import { computeEvm, plannedFraction, sCurve } from '../core/evm';
import type {
  Baseline,
  EvmInputs,
  EvmResult,
  ProgressEntry,
  Project,
  WorkPackage,
} from '../core/types';
import { effectiveBac, effectivePlanItem } from './baseline';
import {
  DEFAULT_THRESHOLDS,
  STAGE_LABEL,
  classifyIndex,
  completionOf,
  stageOf,
  worstStatus,
  type Stage,
  type Status,
  type ThresholdConfig,
} from './status';
import { childrenOf, leaves, roots } from './wbs';

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
  /** Avance físico (EV/BAC, 0..1) a la fecha de corte. */
  completion: number;
  /** Etapa según el avance, que determina qué umbrales se aplicaron. */
  stage: Stage;
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

/**
 * Nodo de la WBS con su EVM. Las hojas traen su dato propio; los nodos de
 * resumen, el roll-up de sus hojas. `depth` es el nivel para indentar.
 */
export interface WbsNode {
  wp: WorkPackage;
  depth: number;
  isLeaf: boolean;
  inputs: EvmInputs;
  evm: EvmResult;
  status: Status;
  exposicion: number;
  /** Etapa del nodo según su avance (para explicar el criterio aplicado). */
  stage: Stage;
  children: WbsNode[];
}

export interface ProjectAnalysis {
  project: Project;
  /** EVM consolidado del proyecto (suma de las hojas de la WBS). */
  evm: EvmResult;
  status: Status;
  /** Análisis por hoja (donde vive el dato) — base del consolidado y decisiones. */
  packages: WorkPackageAnalysis[];
  /** Árbol de la WBS con roll-ups, para la tabla de detalle. */
  tree: WbsNode[];
  /** Ítems que requieren decisión, ordenados por exposición descendente. */
  decisiones: DecisionItem[];
}

/**
 * Construye los insumos EVM de un paquete a la fecha de corte, midiendo contra
 * el plan efectivo (línea base si hay foto de este paquete, o vivo si no).
 */
function inputsForWp(
  wp: WorkPackage,
  progress: ProgressEntry | undefined,
  dataDate: string,
  baseline: Baseline | undefined
): EvmInputs {
  const plan = effectivePlanItem(wp, baseline);
  return {
    pv: plan.presupuesto * plannedFraction(plan, dataDate, sCurve),
    ev: plan.presupuesto * (progress?.avanceFisico ?? 0),
    ac: progress?.costoRealAcum ?? 0,
    bac: plan.presupuesto,
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
  dataDate: string,
  baseline: Baseline | undefined,
  config: ThresholdConfig
): WorkPackageAnalysis {
  const inputs = inputsForWp(wp, progress, dataDate, baseline);
  const evm = computeEvm(inputs);
  const completion = completionOf(inputs.ev, inputs.bac);
  const spiStatus = classifyIndex(evm.spi, completion, config);
  const cpiStatus = classifyIndex(evm.cpi, completion, config);
  return {
    wp,
    inputs,
    evm,
    spiStatus,
    cpiStatus,
    status: worstStatus(spiStatus, cpiStatus),
    exposicion: exposicionDe(evm),
    iniciado: inputs.pv > 0,
    completion,
    stage: stageOf(completion),
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

  // Contexto de etapa: el mismo índice pesa más cuanto más avanzado está.
  const pct = Math.round(a.completion * 100);
  if (a.stage === 'final') {
    partes.push(`en etapa ${STAGE_LABEL[a.stage]} (${pct}% ejecutado), con poco margen para revertirlo`);
  } else if (a.stage === 'inicial') {
    partes.push(`todavía en etapa ${STAGE_LABEL[a.stage]} (${pct}% ejecutado): hay margen si se corrige ahora`);
  } else {
    partes.push(`en etapa ${STAGE_LABEL[a.stage]} (${pct}% ejecutado)`);
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

/**
 * Analiza el proyecto completo: consolidado + por paquete + decisiones.
 * Si se pasa una línea base activa, PV/EV/BAC se miden contra ella; si no, se
 * usa el plan vivo como referencia provisoria.
 */
export function analyzeProject(
  project: Project,
  workPackages: readonly WorkPackage[],
  progressByWp: ReadonlyMap<string, ProgressEntry>,
  dataDate: string,
  baseline?: Baseline,
  config: ThresholdConfig = DEFAULT_THRESHOLDS
): ProjectAnalysis {
  // Solo las hojas cargan dato; el consolidado y las decisiones se arman sobre
  // ellas para no doble-contar los nodos de resumen.
  const hojas = leaves(workPackages);
  const packages = hojas.map((wp) =>
    analyzeWp(wp, progressByWp.get(wp.id), dataDate, baseline, config)
  );
  const inputsById = new Map(packages.map((a) => [a.wp.id, a.inputs]));

  // Consolidado: suma de los insumos de las hojas. El BAC es el de referencia
  // (base activa o suma viva de hojas).
  const consolidated: EvmInputs = {
    pv: packages.reduce((acc, a) => acc + a.inputs.pv, 0),
    ev: packages.reduce((acc, a) => acc + a.inputs.ev, 0),
    ac: packages.reduce((acc, a) => acc + a.inputs.ac, 0),
    bac: effectiveBac(hojas, baseline),
  };
  const evm = computeEvm(consolidated);
  const projCompletion = completionOf(consolidated.ev, consolidated.bac);

  const tree = buildWbsTree(workPackages, inputsById, config);

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
    status: worstStatus(
      classifyIndex(evm.spi, projCompletion, config),
      classifyIndex(evm.cpi, projCompletion, config)
    ),
    packages,
    tree,
    decisiones,
  };
}

/**
 * Construye el árbol de la WBS con roll-ups. Cada hoja toma sus insumos de
 * `leafInputs`; cada nodo de resumen suma los de sus hijos.
 */
function buildWbsTree(
  workPackages: readonly WorkPackage[],
  leafInputs: ReadonlyMap<string, EvmInputs>,
  config: ThresholdConfig = DEFAULT_THRESHOLDS
): WbsNode[] {
  const ZERO: EvmInputs = { pv: 0, ev: 0, ac: 0, bac: 0 };

  function build(wp: WorkPackage, depth: number): WbsNode {
    const kids = childrenOf(wp.id, workPackages);
    let inputs: EvmInputs;
    let children: WbsNode[] = [];

    if (kids.length === 0) {
      inputs = leafInputs.get(wp.id) ?? ZERO;
    } else {
      children = kids.map((k) => build(k, depth + 1));
      inputs = children.reduce(
        (acc, c) => ({
          pv: acc.pv + c.inputs.pv,
          ev: acc.ev + c.inputs.ev,
          ac: acc.ac + c.inputs.ac,
          bac: acc.bac + c.inputs.bac,
        }),
        { ...ZERO }
      );
    }

    const evm = computeEvm(inputs);
    const completion = completionOf(inputs.ev, inputs.bac);
    const status = worstStatus(
      classifyIndex(evm.spi, completion, config),
      classifyIndex(evm.cpi, completion, config)
    );
    return {
      wp,
      depth,
      isLeaf: kids.length === 0,
      inputs,
      evm,
      status,
      exposicion: exposicionDe(evm),
      stage: stageOf(completion),
      children,
    };
  }

  return roots(workPackages).map((wp) => build(wp, 0));
}
