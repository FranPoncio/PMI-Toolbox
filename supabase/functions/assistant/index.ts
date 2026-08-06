// Edge Function de Supabase: el "cerebro" del asistente de PMI Toolbox.
//
// Recibe un brief (proyecto descrito en palabras) y le pide a Claude que lo
// convierta en un ProjectDraft estructurado (WBS, presupuesto, cronograma,
// definición de avance, riesgos, KPIs). La API key de Anthropic vive acá como
// secreto del servidor — NUNCA llega al navegador.
//
// Desplegar:
//   supabase functions deploy assistant --no-verify-jwt
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Runtime: Deno (Supabase Edge). Usa el SDK oficial de Anthropic vía npm:.

import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

// Esquema de salida: obliga a Claude a devolver exactamente esta forma.
// (Structured outputs: additionalProperties:false y required en cada objeto.)
const wpSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nombre: { type: 'string' },
    presupuesto: { type: 'number' },
    peso: { type: 'number' },
    fechaInicioPlan: { type: 'string', description: 'ISO YYYY-MM-DD' },
    fechaFinPlan: { type: 'string', description: 'ISO YYYY-MM-DD' },
    responsable: { type: 'string' },
    parentNombre: { type: ['string', 'null'], description: 'nombre del paquete padre, o null' },
  },
  required: ['nombre', 'presupuesto', 'peso', 'fechaInicioPlan', 'fechaFinPlan', 'responsable', 'parentNombre'],
};

const draftSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nombre: { type: 'string' },
    tipo: { type: 'string', enum: ['obra_civil', 'industrial', 'ti', 'servicios'] },
    moneda: { type: 'string', description: 'código ISO 4217, p. ej. USD, ARS, EUR' },
    bac: { type: 'number', description: 'presupuesto total = suma de las hojas' },
    fechaInicio: { type: 'string', description: 'ISO YYYY-MM-DD' },
    fechaFinPlan: { type: 'string', description: 'ISO YYYY-MM-DD' },
    definicionAvance: { type: 'string', description: 'cómo se mide el % de avance físico en ESTE proyecto' },
    paquetes: { type: 'array', items: wpSchema },
    riesgos: { type: 'string' },
    proximosPasos: { type: 'string' },
    kpis: { type: 'array', items: { type: 'string' } },
    preguntasAbiertas: { type: 'array', items: { type: 'string' } },
    resumen: { type: 'string' },
  },
  required: [
    'nombre', 'tipo', 'moneda', 'bac', 'fechaInicio', 'fechaFinPlan',
    'definicionAvance', 'paquetes', 'riesgos', 'proximosPasos', 'kpis',
    'preguntasAbiertas', 'resumen',
  ],
};

const SYSTEM = `Sos un asistente experto en dirección de proyectos (PMP/PMO) que
prepara proyectos para medirlos con Earned Value Management (EVM). Funcionás para
CUALQUIER tipo de proyecto: obra, industria, software, ventas, promoción,
estudios, investigación, materialización de un producto, etc.

Tu tarea: a partir de la descripción del usuario, armar un plan estructurado
listo para cargar en la herramienta. Reglas:
- Definí "avance físico" en el lenguaje del dominio (ej.: % de m² ejecutados,
  % del target de leads logrado, % de capítulos entregados). Es lo más importante.
- Armá una WBS jerárquica: fases como nodos de resumen (presupuesto 0, peso 0) y
  tareas como hojas que SÍ llevan presupuesto y peso. El padre se referencia por
  su nombre exacto en parentNombre; las fases tienen parentNombre = null.
- El BAC debe ser igual a la suma de los presupuestos de las hojas.
- Los pesos de las hojas deben sumar aproximadamente 100.
- Fechas ISO YYYY-MM-DD, secuenciales y coherentes con inicio y fin.
- Si falta información clave (presupuesto, fechas, definición de avance), incluíla
  en preguntasAbiertas en vez de inventar valores arbitrarios: usá supuestos
  razonables y marcá el supuesto.
- Escribí riesgos, proximosPasos y resumen en prosa clara, en español rioplatense.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'content-type': 'application/json' },
    });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Falta ANTHROPIC_API_KEY en los secretos de la función.' }, 500);

  let brief: Record<string, unknown> | undefined;
  try {
    brief = (await req.json())?.brief;
  } catch {
    return json({ error: 'Cuerpo inválido: se esperaba { brief }.' }, 400);
  }
  if (!brief || typeof (brief as { descripcion?: unknown }).descripcion !== 'string') {
    return json({ error: 'Falta brief.descripcion (la descripción del proyecto).' }, 400);
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system: SYSTEM,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: draftSchema },
      },
      messages: [
        {
          role: 'user',
          content: `Preparado del proyecto a partir de esta descripción y datos:\n\n${JSON.stringify(brief, null, 2)}`,
        },
      ],
    });

    // La salida estructurada llega como texto JSON en el primer bloque de texto.
    const text = message.content.find((b: { type: string }) => b.type === 'text') as
      | { text: string }
      | undefined;
    if (!text) return json({ error: 'El modelo no devolvió contenido.' }, 502);

    const draft = JSON.parse(text.text);
    return json({ draft });
  } catch (e) {
    return json({ error: `Error al consultar a Claude: ${(e as Error).message}` }, 502);
  }
});
