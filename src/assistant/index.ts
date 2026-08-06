/**
 * Armado del asistente de la app. Si están configuradas las variables de
 * entorno de Supabase, usa la IA real; si no, cae al mock por plantillas — así
 * la app siempre funciona, con o sin backend.
 *
 * Para activar la IA real, definí en `.env`:
 *   VITE_ASSISTANT_URL   = https://<proyecto>.supabase.co/functions/v1/assistant
 *   VITE_SUPABASE_ANON_KEY = <clave anónima del proyecto Supabase>
 */

import type { ProjectAssistant } from './assistant';
import { MockAssistant } from './mockAssistant';
import { SupabaseAssistant } from './supabaseAssistant';

export type { ProjectAssistant } from './assistant';
export type { ProjectBrief, ProjectDraft, DraftWorkPackage } from './types';
export { MockAssistant } from './mockAssistant';
export { SupabaseAssistant } from './supabaseAssistant';
export { draftToEntities } from './draft';

// Lectura defensiva de las variables de Vite (evita depender de los tipos de vite/client).
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const url = env.VITE_ASSISTANT_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;

/** Asistente activo: IA real si hay backend configurado, mock si no. */
export const assistant: ProjectAssistant =
  url && anon ? new SupabaseAssistant(url, anon) : new MockAssistant();

/** ¿Está conectada la IA real (Supabase) o corre el mock por plantillas? */
export const assistantIsLive = Boolean(url && anon);
