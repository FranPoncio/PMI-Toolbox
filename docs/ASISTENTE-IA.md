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
[`ProjectAssistant`](../src/assistant/assistant.ts). Hay dos implementaciones
intercambiables:

| Implementación | Qué hace | Requiere |
|---|---|---|
| `MockAssistant` | Plantillas por dominio; funciona **offline** | nada |
| `SupabaseAssistant` | Llama a una **Edge Function** que consulta a **Claude** | Supabase + API key |

La app usa el mock por defecto y **se cambia sola a la IA real** cuando detecta
las variables de entorno de Supabase — nada del store ni de la UI cambia.

```
Navegador ── ProjectAssistant ── SupabaseAssistant ──► Edge Function (Supabase)
                                                              │  (la API key vive acá)
                                                              ▼
                                                        API de Claude
```

## Activar la IA real — 4 pasos

Necesitás una cuenta de **Supabase** (free tier alcanza) y una **API key de
Anthropic** (console.anthropic.com; cobra por uso, centavos por llamada).

### 1. Instalar la CLI de Supabase y enlazar el proyecto

```bash
npm install -g supabase        # o brew install supabase/tap/supabase
supabase login
supabase link --project-ref <TU_PROJECT_REF>   # está en la URL del panel de Supabase
```

### 2. Desplegar la Edge Function

La función ya está en el repo, en [`supabase/functions/assistant/`](../supabase/functions/assistant/index.ts).

```bash
supabase functions deploy assistant --no-verify-jwt
```

### 3. Cargar la API key de Anthropic como secreto del servidor

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

La key queda **solo en el servidor** de Supabase — nunca llega al navegador.

### 4. Apuntar la app a la función

En un archivo `.env` en la raíz del proyecto (Vite lee las variables `VITE_`):

```env
VITE_ASSISTANT_URL=https://<TU_PROJECT_REF>.supabase.co/functions/v1/assistant
VITE_SUPABASE_ANON_KEY=<clave anónima del proyecto, del panel de Supabase>
```

Reconstruí (`npm run build`) o reiniciá el dev server. Listo: el asistente ahora
usa Claude. La `anon key` **no es secreta** (identifica el proyecto); el secreto
es la API key de Anthropic, que quedó en el paso 3.

## Qué modelo usa y cuánto cuesta

La función usa **Claude (`claude-opus-5`)** con salida estructurada (el modelo
está obligado a devolver exactamente el `ProjectDraft`). El costo por proyecto
armado es de centavos; se paga por uso a Anthropic, no a la app.

## Cómo se prueba sin backend

Los tests y la demo usan `MockAssistant`, que arma un plan con plantillas por
dominio (obra / ventas / estudio / software / genérico). Es la prueba de que la
app **no depende** de la IA para funcionar: la IA la mejora, no la sostiene.

## Seguridad

- La API key de Anthropic vive como **secreto de la Edge Function**; el navegador
  nunca la ve.
- La función valida el cuerpo y responde errores claros (sin filtrar internos).
- El `ProjectDraft` que vuelve se **revisa y edita** antes de crear el proyecto —
  la IA propone, vos aprobás.
