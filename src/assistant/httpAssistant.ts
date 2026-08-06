/**
 * Adaptador real, agnóstico del host: delega el análisis a una función HTTP que
 * consulta a Claude (Deno Deploy, Supabase Edge, Cloudflare Workers, Vercel… la
 * misma función Deno corre en varios). La API key vive en el servidor, nunca en
 * el navegador. Es la ÚNICA pieza del cliente que cambia para pasar de mock a IA
 * real; devuelve el mismo `ProjectDraft`.
 */

import type { ProjectAssistant } from './assistant';
import type { ProjectBrief, ProjectDraft } from './types';

export class HttpAssistant implements ProjectAssistant {
  readonly name = 'http';

  /**
   * @param functionUrl URL de la función (p. ej. `https://<app>.deno.dev/`).
   * @param authToken   Token opcional (Supabase pide la anon key; Deno Deploy no).
   */
  constructor(
    private readonly functionUrl: string,
    private readonly authToken?: string
  ) {}

  async analyzeBrief(brief: ProjectBrief): Promise<ProjectDraft> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.authToken) {
      headers.authorization = `Bearer ${this.authToken}`;
      headers.apikey = this.authToken;
    }

    const res = await fetch(this.functionUrl, {
      method: 'POST',
      headers,
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
