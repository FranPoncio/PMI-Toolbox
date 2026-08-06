import { describe, expect, it } from 'vitest';
import { draftToEntities } from './draft';
import { MockAssistant } from './mockAssistant';
import type { ProjectDraft } from './types';

const asistente = new MockAssistant();

describe('MockAssistant — plantillas por dominio', () => {
  it('reconoce una obra y define el avance en el lenguaje del dominio', async () => {
    const d = await asistente.analyzeBrief({
      descripcion: 'Construcción de un gasoducto con planta compresora',
      presupuestoTotal: 20_000_000,
      moneda: 'USD',
    });
    expect(d.tipo).toBe('obra_civil');
    expect(d.definicionAvance.toLowerCase()).toContain('obra');
    expect(d.bac).toBe(20_000_000);
    expect(d.paquetes.length).toBeGreaterThan(0);
  });

  it('reconoce una campaña de ventas y adapta la definición de avance', async () => {
    const d = await asistente.analyzeBrief({ descripcion: 'Campaña de captación de leads y ventas B2B' });
    expect(d.definicionAvance.toLowerCase()).toMatch(/lead|target|ingreso/);
  });

  it('cae en la plantilla genérica para un dominio no reconocido', async () => {
    const d = await asistente.analyzeBrief({ descripcion: 'Organizar un evento comunitario de barrio' });
    expect(d.paquetes.length).toBeGreaterThan(0);
    expect(d.preguntasAbiertas.length).toBeGreaterThan(0);
  });

  it('el BAC coincide con la suma de las hojas (los resúmenes no llevan presupuesto)', async () => {
    const d = await asistente.analyzeBrief({ descripcion: 'Estudio de impacto ambiental', presupuestoTotal: 500_000 });
    const sumaHojas = d.paquetes.filter((p) => p.parentNombre !== null).reduce((a, p) => a + p.presupuesto, 0);
    // Redondeo por hoja puede dejar una diferencia mínima.
    expect(Math.abs(sumaHojas - d.bac)).toBeLessThan(d.paquetes.length);
    expect(d.paquetes.filter((p) => p.parentNombre === null).every((p) => p.presupuesto === 0)).toBe(true);
  });

  it('siempre incluye preguntas abiertas sobre presupuesto, fechas y avance', async () => {
    const d = await asistente.analyzeBrief({ descripcion: 'Proyecto de prueba' });
    expect(d.preguntasAbiertas.some((q) => /avance/i.test(q))).toBe(true);
  });
});

describe('draftToEntities — borrador → modelo', () => {
  const draft: ProjectDraft = {
    nombre: 'Demo',
    tipo: 'servicios',
    moneda: 'USD',
    bac: 1000,
    fechaInicio: '2026-01-01',
    fechaFinPlan: '2026-12-31',
    definicionAvance: '% de entregables',
    riesgos: 'algún riesgo',
    proximosPasos: 'próximos pasos',
    kpis: ['SPI', 'CPI'],
    preguntasAbiertas: [],
    resumen: 'resumen',
    paquetes: [
      { nombre: 'Fase A', presupuesto: 0, peso: 0, fechaInicioPlan: '2026-01-01', fechaFinPlan: '2026-06-30', responsable: '', parentNombre: null },
      { nombre: 'Tarea 1', presupuesto: 600, peso: 60, fechaInicioPlan: '2026-01-01', fechaFinPlan: '2026-03-31', responsable: 'R', parentNombre: 'Fase A' },
      { nombre: 'Tarea 2', presupuesto: 400, peso: 40, fechaInicioPlan: '2026-04-01', fechaFinPlan: '2026-06-30', responsable: 'R', parentNombre: 'Fase A' },
    ],
  };

  it('crea el proyecto con riesgos/próximos pasos y resuelve la jerarquía por nombre', () => {
    let n = 0;
    const { project, workPackages } = draftToEntities(draft, () => `id-${n++}`);
    expect(project.riesgos).toBe('algún riesgo');
    expect(project.proximosPasos).toBe('próximos pasos');
    expect(workPackages).toHaveLength(3);

    const fase = workPackages.find((w) => w.nombre === 'Fase A')!;
    const t1 = workPackages.find((w) => w.nombre === 'Tarea 1')!;
    expect(fase.parentId).toBeNull();
    expect(t1.parentId).toBe(fase.id); // hija apunta a la fase
    expect(workPackages.every((w) => w.projectId === project.id)).toBe(true);
  });
});
