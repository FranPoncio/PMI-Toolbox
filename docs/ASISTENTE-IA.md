# Asistente de IA — armar cualquier proyecto para medirlo con EVM

El asistente toma un proyecto **descrito en palabras** —de cualquier dominio:
obra, industria, software, ventas, promoción, estudio, investigación— y devuelve
un **plan estructurado listo para el motor EVM**: WBS, presupuesto, cronograma,
riesgos, KPIs y, lo más importante, **cómo se mide el avance físico en ESE
proyecto** (m² ejecutados, leads logrados, capítulos entregados…).

El motor de cálculo es universal; la IA hace de **traductor** entre cualquier
proyecto y ese motor.

## Cómo está armado (puerto + adaptadores)

Igual que la capa de datos, el asistente vive detrás de un **puerto**
[`ProjectAssistant`](../src/assistant/assistant.ts). Dos implementaciones
intercambiables:

| Implementación | Qué hace | Requiere |
|---|---|---|
| `MockAssistant` | Plantillas por dominio; funciona **offline** | nada |
| `HttpAssistant` | Llama a una **función serverless** que consulta a **Claude** | un host + API key |

La app usa el mock por defecto y **se cambia sola a la IA real** cuando detecta
la variable `VITE_ASSISTANT_URL` — nada del store ni de la UI cambia.

```
Navegador ── ProjectAssistant ── HttpAssistant ──► función (Deno Deploy / Supabase / …)
                                                        │  (la API key vive acá)
                                                        ▼
                                                   API de Claude
```

La función está en [`supabase/functions/assistant/index.ts`](../supabase/functions/assistant/index.ts).
Está escrita en **Deno** (`Deno.serve`), así que **el mismo archivo corre en Deno
Deploy, Supabase Edge, o cualquier runtime Deno** — sin cambios.

## Activar la IA real — opción recomendada: Deno Deploy (gratis, no se duerme)

Necesitás una cuenta de **Deno Deploy** (free tier) y una **API key de Anthropic**
(console.anthropic.com; cobra por uso, centavos por proyecto, con créditos de
prueba al empezar).

1. **Crear el proyecto** en [dash.deno.com](https://dash.deno.com) → *New Project*.
   Apuntalo al repo y al entrypoint `supabase/functions/assistant/index.ts`
   (o pegá el archivo con *Playground*).
2. **Cargar la API key** como variable de entorno del proyecto en Deno Deploy:
   `ANTHROPIC_API_KEY = sk-ant-...`. Queda **solo en el servidor**.
3. **Apuntar la app** — en un `.env` en la raíz (Vite lee las `VITE_`):

   ```env
   VITE_ASSISTANT_URL=https://<tu-proyecto>.deno.dev
   # VITE_ASSISTANT_TOKEN no hace falta en Deno Deploy
   ```

4. `npm run build` (o reiniciar el dev server). Listo: el botón **✨ Con IA** ahora
   usa Claude.

### Alternativa: Supabase Edge Functions

Mismo archivo. Requiere la CLI de Supabase:

```bash
supabase functions deploy assistant --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

```env
VITE_ASSISTANT_URL=https://<ref>.supabase.co/functions/v1/assistant
VITE_ASSISTANT_TOKEN=<clave anónima del proyecto>   # Supabase sí pide un token
```

> Nota: el free tier de Supabase **pausa** los proyectos inactivos; Deno Deploy no.
> Por eso, para una herramienta de uso esporádico, Deno Deploy es más cómodo.

## Qué modelo usa y cuánto cuesta

La función usa **Claude (`claude-opus-5`)** con salida estructurada (el modelo
está obligado a devolver exactamente el `ProjectDraft`). El costo por proyecto
armado es de **centavos**; se paga por uso a Anthropic.

> ⚠️ **Endpoint público = tu key paga el uso de todos.** Si publicás la app y la
> función es abierta, cada persona que arme un proyecto consume tu saldo de
> Anthropic. Para un portfolio/demo con poco tráfico es insignificante; si crece,
> conviene sumarle un límite de uso (rate limit) a la función.

## Cómo se prueba sin backend

El botón **✨ Con IA** funciona igual sin configurar nada: usa `MockAssistant`,
que arma un plan con plantillas por dominio (obra / ventas / estudio / software /
genérico). Es la prueba de que la app **no depende** de la IA para funcionar: la
IA la mejora, no la sostiene. El modal avisa si está en modo demo o con IA real.

## Seguridad

- La API key de Anthropic vive como **variable de entorno del servidor**; el
  navegador nunca la ve.
- La función valida el cuerpo y responde errores claros (sin filtrar internos).
- El `ProjectDraft` que vuelve se **revisa y edita** antes de crear el proyecto —
  la IA propone, vos aprobás.
