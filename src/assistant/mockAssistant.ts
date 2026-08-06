/**
 * Implementación offline del asistente, por plantillas. No usa IA: reconoce el
 * dominio del proyecto por palabras clave y arma una WBS razonable. Sirve para
 * (a) que la app funcione sin backend, (b) tests, y (c) demostrar el flujo antes
 * de conectar Claude. La implementación real (`SupabaseAssistant`) devuelve el
 * mismo `ProjectDraft`, así que la UI no cambia.
 */

import type { ProjectType } from '../core/types';
import type { ProjectAssistant } from './assistant';
import type { DraftWorkPackage, ProjectBrief, ProjectDraft } from './types';

interface Plantilla {
  tipo: ProjectType;
  definicionAvance: string;
  /** Fases de la WBS con su reparto de peso (proporción del total). */
  fases: Array<{ nombre: string; peso: number; sub: string[] }>;
  kpis: string[];
}

const GENERICA: Plantilla = {
  tipo: 'servicios',
  definicionAvance: '% de entregables completados y aceptados a la fecha de corte.',
  fases: [
    { nombre: 'Planificación', peso: 0.15, sub: ['Definición de alcance', 'Cronograma y presupuesto'] },
    { nombre: 'Ejecución', peso: 0.6, sub: ['Desarrollo del trabajo', 'Control de calidad'] },
    { nombre: 'Cierre', peso: 0.25, sub: ['Entrega', 'Documentación final'] },
  ],
  kpis: ['SPI (plazo)', 'CPI (costo)', '% de entregables aceptados'],
};

const PLANTILLAS: Array<{ claves: RegExp; p: Plantilla }> = [
  {
    claves: /obra|constru|edific|vivienda|casa|ducto|gasoduc|planta|infraestruct|civil|montaje/i,
    p: {
      tipo: 'obra_civil',
      definicionAvance: '% de partidas de obra ejecutadas y certificadas (avance físico de obra).',
      fases: [
        { nombre: 'Ingeniería y permisos', peso: 0.12, sub: ['Ingeniería de detalle', 'Permisos y habilitaciones'] },
        { nombre: 'Obras civiles', peso: 0.45, sub: ['Movimiento de suelos', 'Fundaciones y estructura'] },
        { nombre: 'Montaje e instalaciones', peso: 0.28, sub: ['Montaje electromecánico', 'Instalaciones'] },
        { nombre: 'Pruebas y puesta en marcha', peso: 0.15, sub: ['Pruebas', 'Puesta en marcha'] },
      ],
      kpis: ['SPI (plazo)', 'CPI (costo)', '% de partidas certificadas', 'Curva S de avance'],
    },
  },
  {
    claves: /venta|comercial|promoci|marketing|campañ|lead|captaci|clientes|ingreso/i,
    p: {
      tipo: 'servicios',
      definicionAvance: '% del target de leads/ingresos logrado sobre el objetivo del período.',
      fases: [
        { nombre: 'Estrategia', peso: 0.2, sub: ['Definición de segmentos', 'Plan de medios'] },
        { nombre: 'Ejecución de campaña', peso: 0.5, sub: ['Contenidos y piezas', 'Pauta y difusión'] },
        { nombre: 'Conversión y cierre', peso: 0.3, sub: ['Captación de leads', 'Seguimiento y cierre'] },
      ],
      kpis: ['SPI (plazo)', 'CPI (costo)', '% del target de leads', 'Costo por lead'],
    },
  },
  {
    claves: /estudio|investiga|análisis|analisis|tesis|informe|relevamiento|diagnóstic|diagnostic|consultor/i,
    p: {
      tipo: 'servicios',
      definicionAvance: '% de capítulos / hitos del estudio completados y revisados.',
      fases: [
        { nombre: 'Diseño del estudio', peso: 0.2, sub: ['Marco y objetivos', 'Metodología'] },
        { nombre: 'Relevamiento y análisis', peso: 0.5, sub: ['Recolección de datos', 'Análisis'] },
        { nombre: 'Redacción y entrega', peso: 0.3, sub: ['Redacción del informe', 'Revisión y entrega'] },
      ],
      kpis: ['SPI (plazo)', 'CPI (costo)', '% de capítulos entregados'],
    },
  },
  {
    claves: /software|app|sistema|plataforma|desarrollo|ti\b|it\b|producto digital/i,
    p: {
      tipo: 'ti',
      definicionAvance: '% de historias/funcionalidades completadas y aceptadas.',
      fases: [
        { nombre: 'Descubrimiento', peso: 0.15, sub: ['Relevamiento', 'Arquitectura'] },
        { nombre: 'Construcción', peso: 0.6, sub: ['Desarrollo', 'Pruebas'] },
        { nombre: 'Lanzamiento', peso: 0.25, sub: ['Despliegue', 'Estabilización'] },
      ],
      kpis: ['SPI (plazo)', 'CPI (costo)', '% de funcionalidades aceptadas'],
    },
  },
];

function elegirPlantilla(texto: string): Plantilla {
  return PLANTILLAS.find((x) => x.claves.test(texto))?.p ?? GENERICA;
}

function isoAtFraction(startIso: string, endIso: string, t: number): string {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  return new Date(start + t * (end - start)).toISOString().slice(0, 10);
}

/** Deriva fechas si no vinieron: 12 meses desde hoy. */
function ventana(brief: ProjectBrief): { inicio: string; fin: string } {
  const hoy = new Date().toISOString().slice(0, 10);
  const inicio = brief.fechaInicio || hoy;
  if (brief.fechaFin) return { inicio, fin: brief.fechaFin };
  const finMs = Date.parse(inicio) + 365 * 86_400_000;
  return { inicio, fin: new Date(finMs).toISOString().slice(0, 10) };
}

/** Título por defecto tomado de la primera línea de la descripción. */
function titulo(desc: string): string {
  const linea = desc.trim().split(/[\n.]/)[0]!.trim();
  return linea.length > 3 ? linea.slice(0, 80) : 'Proyecto nuevo';
}

export class MockAssistant implements ProjectAssistant {
  readonly name = 'mock';

  async analyzeBrief(brief: ProjectBrief): Promise<ProjectDraft> {
    const plantilla = elegirPlantilla(brief.descripcion);
    const tipo = brief.tipo ?? plantilla.tipo;
    const moneda = brief.moneda ?? 'USD';
    const bac = brief.presupuestoTotal && brief.presupuestoTotal > 0 ? brief.presupuestoTotal : 1_000_000;
    const { inicio, fin } = ventana(brief);

    // Reparte fases en el tiempo, secuenciales, y presupuesto por peso.
    const paquetes: DraftWorkPackage[] = [];
    let acc = 0;
    for (const fase of plantilla.fases) {
      const fIni = isoAtFraction(inicio, fin, acc);
      const fFin = isoAtFraction(inicio, fin, acc + fase.peso);
      // Nodo de resumen (sin presupuesto propio; se deriva por roll-up).
      paquetes.push({
        nombre: fase.nombre,
        presupuesto: 0,
        peso: 0,
        fechaInicioPlan: fIni,
        fechaFinPlan: fFin,
        responsable: '',
        parentNombre: null,
      });
      // Hojas: reparten el presupuesto y peso de la fase en partes iguales.
      const porHoja = (bac * fase.peso) / fase.sub.length;
      const pesoHoja = fase.peso / fase.sub.length;
      fase.sub.forEach((nombre, i) => {
        const t0 = acc + (fase.peso * i) / fase.sub.length;
        const t1 = acc + (fase.peso * (i + 1)) / fase.sub.length;
        paquetes.push({
          nombre,
          presupuesto: Math.round(porHoja),
          peso: Number((pesoHoja * 100).toFixed(2)),
          fechaInicioPlan: isoAtFraction(inicio, fin, t0),
          fechaFinPlan: isoAtFraction(inicio, fin, t1),
          responsable: '',
          parentNombre: fase.nombre,
        });
      });
      acc += fase.peso;
    }

    return {
      nombre: titulo(brief.descripcion),
      tipo,
      moneda,
      bac,
      fechaInicio: inicio,
      fechaFinPlan: fin,
      definicionAvance: plantilla.definicionAvance,
      paquetes,
      riesgos:
        'Riesgos iniciales a validar: disponibilidad de recursos, cumplimiento de plazos de terceros y variaciones de costo. Revisar y completar según el proyecto real.',
      proximosPasos:
        'Ajustar presupuestos y fechas de cada paquete, asignar responsables y congelar la línea base antes de cargar el primer corte.',
      kpis: plantilla.kpis,
      preguntasAbiertas: [
        '¿Cuál es el presupuesto total autorizado (BAC) y en qué moneda?',
        '¿Cuáles son las fechas de inicio y fin comprometidas?',
        `Para este proyecto, ¿cómo definís el avance físico? (propuesta: ${plantilla.definicionAvance})`,
      ],
      resumen: `Borrador armado con una plantilla de tipo «${tipo}». Definí el avance como: ${plantilla.definicionAvance} Ajustá los paquetes y validá las preguntas abiertas antes de congelar la línea base.`,
    };
  }
}
