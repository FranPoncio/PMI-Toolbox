/**
 * Tipos del asistente de IA. El asistente toma un proyecto descrito en palabras
 * —de cualquier dominio: obra, venta, estudio, promoción— y devuelve un
 * **borrador estructurado** (`ProjectDraft`) que se puede cargar directo en el
 * motor EVM. La clave de la adaptabilidad está en `definicionAvance`: qué
 * significa "avance físico" en ESE proyecto.
 */

import type { ProjectType } from '../core/types';

/** Lo que el usuario describe (más las respuestas a las preguntas del asistente). */
export interface ProjectBrief {
  /** Descripción libre del proyecto, en las palabras del usuario. */
  descripcion: string;
  /** Pistas opcionales que acotan el borrador. */
  tipo?: ProjectType;
  moneda?: string;
  presupuestoTotal?: number;
  fechaInicio?: string;
  fechaFin?: string;
  /** Respuestas a preguntas de seguimiento (clave = pregunta). */
  respuestas?: Record<string, string>;
}

/** Un paquete de trabajo propuesto. La jerarquía se expresa por nombre del padre. */
export interface DraftWorkPackage {
  nombre: string;
  /** Presupuesto del paquete, en la moneda del proyecto. */
  presupuesto: number;
  /** Peso relativo dentro del proyecto (proporción sobre el total). */
  peso: number;
  fechaInicioPlan: string;
  fechaFinPlan: string;
  responsable: string;
  /** Nombre del paquete padre en la WBS, o null si cuelga de la raíz. */
  parentNombre: string | null;
}

/**
 * Borrador de proyecto que produce el asistente. Mapea al modelo del motor:
 * `nombre/tipo/moneda/bac/fechas` → Project; `paquetes` → WorkPackage[].
 */
export interface ProjectDraft {
  nombre: string;
  tipo: ProjectType;
  moneda: string;
  /** Budget At Completion: presupuesto total (= suma de las hojas). */
  bac: number;
  fechaInicio: string;
  fechaFinPlan: string;
  /**
   * Cómo se mide el "avance físico" en este proyecto — el corazón de la
   * adaptabilidad. Ej.: "% de m² ejecutados", "% del target de leads logrado",
   * "% de capítulos entregados".
   */
  definicionAvance: string;
  paquetes: DraftWorkPackage[];
  /** Riesgos e issues iniciales (narrativa ISR/PMR). */
  riesgos: string;
  /** Próximos pasos sugeridos. */
  proximosPasos: string;
  /** Indicadores clave que conviene seguir en este proyecto. */
  kpis: string[];
  /** Qué información falta todavía para medir bien (preguntas al usuario). */
  preguntasAbiertas: string[];
  /** Conclusión escrita del asistente sobre el plan propuesto. */
  resumen: string;
}
