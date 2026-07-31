import { useMemo } from 'react';
import { analyzeProject, type ProjectAnalysis } from '../analytics/decisions';
import {
  allCutDates,
  cutDatesUpTo,
  evmHistory,
  vigenteByWp,
  type CurvePoint,
} from '../analytics/resolve';
import type { Project } from '../core/types';
import { usePmStore } from './pmStore';

export interface ProjectView {
  project: Project;
  analysis: ProjectAnalysis;
  history: CurvePoint[];
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
  const dataDate = usePmStore((s) => s.dataDate);

  return useMemo(() => {
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project || !dataDate) return null;

    const vigentes = vigenteByWp(progressEntries, dataDate);
    const analysis = analyzeProject(project, workPackages, vigentes, dataDate);

    // Historia para la curva: fechas de corte hasta la fecha elegida.
    const dates = cutDatesUpTo(progressEntries, dataDate);
    const history = evmHistory(workPackages, progressEntries, dates.length ? dates : [dataDate]);

    return {
      project,
      analysis,
      history,
      availableCuts: allCutDates(progressEntries),
      dataDate,
    };
  }, [projects, selectedProjectId, workPackages, progressEntries, dataDate]);
}
