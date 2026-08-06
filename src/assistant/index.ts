/**
 * Armado del asistente de la app. Si está configurada la URL de la función de
 * IA, usa la IA real; si no, cae al mock por plantillas — así la app siempre
 * funciona, con o sin backend.
 *
 * Para activar la IA real, definí en `.env`:
 *   VITE_ASSISTANT_URL       = https://<tu-funcion>            (Deno Deploy, Supabase, etc.)
 *   VITE_ASSISTANT_TOKEN     = <token opcional>                (Supabase: anon key; Deno Deploy: no hace falta)
 */

import type { ProjectAssistant } from './assistant';
import { HttpAssistant } from './httpAssistant';
import { MockAssistant } from './mockAssistant';

export type { ProjectAssistant } from './assistant';
export type { ProjectBrief, ProjectDraft, DraftWorkPackage } from './types';
export { MockAssistant } from './mockAssistant';
export { HttpAssistant } from './httpAssistant';
export { draftToEntities } from './draft';

// Lectura defensiva de las variables de Vite (evita depender de los tipos de vite/client).
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const url = env.VITE_ASSISTANT_URL;
const token = env.VITE_ASSISTANT_TOKEN;

/** Asistente activo: IA real si hay una URL configurada, mock si no. */
export const assistant: ProjectAssistant = url ? new HttpAssistant(url, token) : new MockAssistant();

/** ¿Está conectada la IA real o corre el mock por plantillas? */
export const assistantIsLive = Boolean(url);
