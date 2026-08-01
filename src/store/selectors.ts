import { useMemo } from 'react';
import {
  activeBaseline,
  diffBaseline,
  effectiveBac,
  effectivePlanItem,
  type BaselineDivergence,
} from '../analytics/baseline';
import { analyzeProject, type ProjectAnalysis } from '../analytics/decisions';
import {
  allCutDates,
  cutDatesUpTo,
  evmHistory,
  vigenteByWp,
  type CurvePoint,
  type EffectiveItem,
} from '../analytics/resolve';
import { scheduleForecast, type ScheduleForecast } from '../analytics/schedule';
import { leaves } from '../analytics/wbs';
import type { Baseline, PlannedItem, Project } from '../core/types';
import { usePmStore } from './pmStore';

export interface ProjectView {
  project: Project;
  analysis: ProjectAnalysis;
  history: CurvePoint[];
  /** Pronóstico de plazo por Earned Schedule. */
  forecast: ScheduleForecast;
  /** Ítems de plan efectivos (línea base si hay) y BAC de referencia. */
  planItems: PlannedItem[];
  bac: number;
  /** Línea base activa (o `undefined`) y todas las del proyecto. */
  baseline: Baseline | undefined;
  baselines: Baseline[];
  /** Divergencia entre la estructura viva y la línea base activa. */
  divergence: BaselineDivergence;
  /** Todas las fechas de corte disponibles del proyecto (para el selector). */
  availableCuts: string[];
  dataDate: string;
}

/**
 * Deriva la vista del proyecto seleccionado a la fecha de corte elegida:
 * análisis EVM (con el corte vigente por paquete) e historia para la curva S.
 * Recalcula sólo cuando cambian los datos relevantes.
 */
export function useProjectView(): ProjectView | null {
  const projects = usePmStore((s) => s.projects);
  const selectedProjectId = usePmStore((s) => s.selectedProjectId);
  const workPackages = usePmStore((s) => s.workPackages);
  const progressEntries = usePmStore((s) => s.progressEntries);
  const baselines = usePmStore((s) => s.baselines);
  const dataDate = usePmStore((s) => s.dataDate);
  const thresholds = usePmStore((s) => s.thresholds);

  return useMemo(() => {
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project || !dataDate) return null;

    const baseline = activeBaseline(baselines);
    const vigentes = vigenteByWp(progressEntries, dataDate);
    const analysis = analyzeProject(project, workPackages, vigentes, dataDate, baseline, thresholds);

    // Ítems efectivos: solo las hojas (donde vive el plan), con línea base si hay.
    const hojas = leaves(workPackages);
    const effectiveItems: EffectiveItem[] = hojas.map((wp) => ({
      id: wp.id,
      ...effectivePlanItem(wp, baseline),
    }));
    const bac = effectiveBac(hojas, baseline);

    // Historia para la curva: fechas de corte hasta la fecha elegida.
    const dates = cutDatesUpTo(progressEntries, dataDate);
    const history = evmHistory(effectiveItems, progressEntries, dates.length ? dates : [dataDate]);

    const forecast = scheduleForecast(project, effectiveItems, bac, analysis.evm.ev, dataDate);

    return {
      project,
      analysis,
      history,
      forecast,
      planItems: effectiveItems,
      bac,
      baseline,
      baselines,
      divergence: diffBaseline(baseline, workPackages),
      availableCuts: allCutDates(progressEntries),
      dataDate,
    };
  }, [projects, selectedProjectId, workPackages, progressEntries, baselines, dataDate, thresholds]);
}
