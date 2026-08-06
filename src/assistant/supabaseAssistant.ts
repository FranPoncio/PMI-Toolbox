/**
 * Adaptador real: delega el análisis a una Edge Function de Supabase que
 * consulta a Claude (la API key vive segura en el servidor, nunca en el
 * navegador). Es la ÚNICA pieza del cliente que cambia para pasar de mock a IA
 * real; devuelve el mismo `ProjectDraft`.
 */

import type { ProjectAssistant } from './assistant';
import type { ProjectBrief, ProjectDraft } from './types';

export class SupabaseAssistant implements ProjectAssistant {
  readonly name = 'supabase';

  /**
   * @param functionUrl URL de la Edge Function (p. ej. `${SUPABASE_URL}/functions/v1/assistant`).
   * @param anonKey     Clave anónima de Supabase (identifica el proyecto; no es secreta).
   */
  constructor(
    private readonly functionUrl: string,
    private readonly anonKey: string
  ) {}

  async analyzeBrief(brief: ProjectBrief): Promise<ProjectDraft> {
    const res = await fetch(this.functionUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.anonKey}`,
        apikey: this.anonKey,
      },
      body: JSON.stringify({ brief }),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      throw new Error(`El asistente no pudo responder (HTTP ${res.status}). ${detalle}`.trim());
    }

    const data = (await res.json()) as { draft?: ProjectDraft; error?: string };
    if (data.error) throw new Error(data.error);
    if (!data.draft) throw new Error('El asistente devolvió una respuesta vacía.');
    return data.draft;
  }
}
