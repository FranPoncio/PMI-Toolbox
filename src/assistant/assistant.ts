/**
 * Puerto del asistente de IA (mismo patrón puerto/adaptador que la capa de
 * datos). La app depende de este contrato, no de una implementación concreta:
 *
 *  - `MockAssistant`     — plantillas por dominio, funciona offline (tests/demo).
 *  - `SupabaseAssistant` — llama a una Edge Function que consulta a Claude.
 *
 * Cambiar de uno a otro es cambiar qué se enchufa en `index.ts` — nada más.
 */

import type { ProjectBrief, ProjectDraft } from './types';

export interface ProjectAssistant {
  /** Nombre de la implementación (para diagnóstico/UI). */
  readonly name: string;
  /** Convierte una descripción de proyecto en un borrador estructurado. */
  analyzeBrief(brief: ProjectBrief): Promise<ProjectDraft>;
}
