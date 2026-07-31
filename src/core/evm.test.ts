import { describe, expect, it } from 'vitest';
import {
  actualCost,
  budgetAtCompletion,
  computeEvm,
  costPerformanceIndex,
  costVariance,
  earnedValue,
  estimateAtCompletion,
  estimateToComplete,
  linearCurve,
  plannedFraction,
  plannedValue,
  sCurve,
  schedulePerformanceIndex,
  scheduleVariance,
  tcpiToBac,
  tcpiToEac,
  varianceAtCompletion,
} from './evm';
import type { EvmInputs, ProgressEntry, WorkPackage } from './types';

// Caso de referencia "de libro": proyecto atrasado y con sobrecosto leve.
// BAC=1000, a la fecha de corte se planificó 500 (PV), se ejecutó 400 (EV)
// y costó 500 (AC).
const REF: EvmInputs = { pv: 500, ev: 400, ac: 500, bac: 1000 };

describe('variaciones', () => {
  it('SV = EV − PV (atrasado ⇒ negativo)', () => {
    expect(scheduleVariance(REF.ev, REF.pv)).toBe(-100);
  });

  it('CV = EV − AC (sobrecosto ⇒ negativo)', () => {
    expect(costVariance(REF.ev, REF.ac)).toBe(-100);
  });

  it('SV positivo cuando se adelanta el trabajo', () => {
    expect(scheduleVariance(600, 500)).toBe(100);
  });
});

describe('índices de desempeño', () => {
  it('SPI = EV / PV', () => {
    expect(schedulePerformanceIndex(400, 500)).toBe(0.8);
  });

  it('CPI = EV / AC', () => {
    expect(costPerformanceIndex(400, 500)).toBe(0.8);
  });

  it('proyecto sano (adelantado y bajo presupuesto) ⇒ índices > 1', () => {
    expect(schedulePerformanceIndex(600, 500)).toBe(1.2);
    expect(costPerformanceIndex(600, 500)).toBe(1.2);
  });
});

describe('EAC — tres variantes', () => {
  it('cpi: BAC / CPI', () => {
    // CPI = 400/500 = 0.8 ⇒ EAC = 1000 / 0.8 = 1250
    expect(estimateAtCompletion(REF, 'cpi')).toBe(1250);
  });

  it('budgetRate: AC + (BAC − EV)', () => {
    // 500 + (1000 − 400) = 1100
    expect(estimateAtCompletion(REF, 'budgetRate')).toBe(1100);
  });

  it('cpiSpi: AC + (BAC − EV) / (CPI × SPI)', () => {
    // CPI=0.8, SPI=0.8 ⇒ factor=0.64 ⇒ 500 + 600/0.64 = 1437.5
    expect(estimateAtCompletion(REF, 'cpiSpi')).toBeCloseTo(1437.5, 6);
  });

  it('las tres variantes coinciden cuando el desempeño es perfecto (CPI=SPI=1)', () => {
    const onPlan: EvmInputs = { pv: 500, ev: 500, ac: 500, bac: 1000 };
    expect(estimateAtCompletion(onPlan, 'cpi')).toBe(1000);
    expect(estimateAtCompletion(onPlan, 'budgetRate')).toBe(1000);
    expect(estimateAtCompletion(onPlan, 'cpiSpi')).toBe(1000);
  });
});

describe('ETC y VAC', () => {
  it('ETC = EAC − AC', () => {
    expect(estimateToComplete(1250, 500)).toBe(750);
  });

  it('VAC = BAC − EAC (EAC>BAC ⇒ VAC negativo)', () => {
    expect(varianceAtCompletion(1000, 1250)).toBe(-250);
  });

  it('ETC y VAC propagan null cuando EAC es null', () => {
    expect(estimateToComplete(null, 500)).toBeNull();
    expect(varianceAtCompletion(1000, null)).toBeNull();
  });
});

describe('TCPI', () => {
  it('contra BAC = (BAC − EV) / (BAC − AC)', () => {
    // (1000 − 400) / (1000 − 500) = 600/500 = 1.2
    expect(tcpiToBac(400, 500, 1000)).toBe(1.2);
  });

  it('contra EAC = (BAC − EV) / (EAC − AC)', () => {
    // (1000 − 400) / (1250 − 500) = 600/750 = 0.8
    expect(tcpiToEac(400, 500, 1000, 1250)).toBe(0.8);
  });

  it('contra EAC es null si el EAC es null', () => {
    expect(tcpiToEac(400, 500, 1000, null)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Casos borde
// ────────────────────────────────────────────────────────────────────────────

describe('caso borde — avance cero (arranque del proyecto)', () => {
  // Nada ejecutado: EV=0, AC=0. Se había planificado algo (PV>0).
  const start: EvmInputs = { pv: 200, ev: 0, ac: 0, bac: 1000 };

  it('SPI = 0 (EV=0, PV>0): definido, no null', () => {
    expect(schedulePerformanceIndex(start.ev, start.pv)).toBe(0);
  });

  it('CPI es null porque AC=0', () => {
    expect(costPerformanceIndex(start.ev, start.ac)).toBeNull();
  });

  it('SV = −PV, CV = 0', () => {
    expect(scheduleVariance(start.ev, start.pv)).toBe(-200);
    expect(costVariance(start.ev, start.ac)).toBe(0);
  });

  it('EAC cpi y cpiSpi son null (dependen de CPI); budgetRate = BAC', () => {
    expect(estimateAtCompletion(start, 'cpi')).toBeNull();
    expect(estimateAtCompletion(start, 'cpiSpi')).toBeNull();
    expect(estimateAtCompletion(start, 'budgetRate')).toBe(1000);
  });
});

describe('caso borde — PV cero (nada planificado aún a la fecha de corte)', () => {
  it('SPI es null porque PV=0', () => {
    expect(schedulePerformanceIndex(0, 0)).toBeNull();
    expect(schedulePerformanceIndex(100, 0)).toBeNull();
  });

  it('cpiSpi es null si SPI es null aunque haya CPI', () => {
    const inp: EvmInputs = { pv: 0, ev: 100, ac: 80, bac: 1000 };
    expect(costPerformanceIndex(inp.ev, inp.ac)).toBeCloseTo(1.25, 6);
    expect(estimateAtCompletion(inp, 'cpiSpi')).toBeNull();
  });
});

describe('caso borde — costo cero pero con avance (EV>0, AC=0)', () => {
  const inp: EvmInputs = { pv: 100, ev: 150, ac: 0, bac: 1000 };

  it('CPI es null (división por cero), no Infinity', () => {
    const cpi = costPerformanceIndex(inp.ev, inp.ac);
    expect(cpi).toBeNull();
    expect(Number.isFinite(cpi as unknown as number)).toBe(false);
  });

  it('TCPI contra BAC sigue definido (denominador BAC − AC = BAC)', () => {
    expect(tcpiToBac(inp.ev, inp.ac, inp.bac)).toBeCloseTo(0.85, 6);
  });
});

describe('caso borde — división por cero en TCPI (BAC = AC)', () => {
  it('TCPI contra BAC es null cuando BAC − AC = 0', () => {
    expect(tcpiToBac(900, 1000, 1000)).toBeNull();
  });

  it('TCPI contra EAC es null cuando EAC − AC = 0', () => {
    expect(tcpiToEac(900, 1000, 1000, 1000)).toBeNull();
  });
});

describe('caso borde — proyecto terminado (EV = BAC)', () => {
  // Terminado, ejecutado todo el alcance (EV=BAC=1000), costó 1100 (sobrecosto).
  const done: EvmInputs = { pv: 1000, ev: 1000, ac: 1100, bac: 1000 };

  it('SPI = 1 al cierre (EV=PV)', () => {
    expect(schedulePerformanceIndex(done.ev, done.pv)).toBe(1);
  });

  it('CPI < 1 refleja el sobrecosto final', () => {
    expect(costPerformanceIndex(done.ev, done.ac)).toBeCloseTo(0.9091, 4);
  });

  it('EAC converge al costo real y VAC = BAC − AC', () => {
    // budgetRate: AC + (BAC − EV) = 1100 + 0 = 1100 = costo real final
    expect(estimateAtCompletion(done, 'budgetRate')).toBe(1100);
    expect(varianceAtCompletion(done.bac, 1100)).toBe(-100);
  });

  it('TCPI contra BAC = 0 (no queda alcance por ganar)', () => {
    // (BAC − EV) = 0 ⇒ TCPI = 0 (BAC − AC = −100 ≠ 0).
    // toBeCloseTo evita el distingo −0 / +0 de Object.is.
    expect(tcpiToBac(done.ev, done.ac, done.bac)).toBeCloseTo(0, 10);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Derivación desde el modelo de datos
// ────────────────────────────────────────────────────────────────────────────

function wp(partial: Partial<WorkPackage> & Pick<WorkPackage, 'id' | 'presupuesto'>): WorkPackage {
  return {
    projectId: 'p1',
    nombre: partial.id,
    peso: partial.presupuesto,
    fechaInicioPlan: '2026-01-01',
    fechaFinPlan: '2026-12-31',
    responsable: 'n/a',
    ...partial,
  };
}

function progress(
  workPackageId: string,
  avanceFisico: number,
  costoRealAcum: number
): ProgressEntry {
  return {
    id: `${workPackageId}-pe`,
    workPackageId,
    fechaCorte: '2026-06-30',
    avanceFisico,
    costoRealAcum,
  };
}

describe('derivación de curvas desde work packages y avances', () => {
  const packages: WorkPackage[] = [
    wp({ id: 'a', presupuesto: 400, fechaInicioPlan: '2026-01-01', fechaFinPlan: '2026-12-31' }),
    wp({ id: 'b', presupuesto: 600, fechaInicioPlan: '2026-01-01', fechaFinPlan: '2026-12-31' }),
  ];

  it('BAC = suma de presupuestos', () => {
    expect(budgetAtCompletion(packages)).toBe(1000);
  });

  it('plannedFraction (curva S por defecto): 0 antes del inicio, 1 después del fin', () => {
    const single = packages[0]!;
    expect(plannedFraction(single, '2025-12-31')).toBe(0);
    expect(plannedFraction(single, '2027-01-01')).toBe(1);
    // Ventana Jan 1 → Dec 31 = 364 días; Jul 2 está a 182 días ⇒ t = 0.5.
    // La curva S es simétrica: sCurve(0.5) = 0.5.
    expect(plannedFraction(single, '2026-07-02')).toBeCloseTo(0.5, 6);
  });

  it('curva S vs lineal: arranque más lento (t=0.25 ⇒ 0.156 < 0.25)', () => {
    const single = packages[0]!;
    // 2026-04-02 está a ~91 días ⇒ t ≈ 0.25.
    // sCurve(0.25) = 0.25²·(3 − 0.5) = 0.15625; lineal daría 0.25.
    const s = plannedFraction(single, '2026-04-02');
    const l = plannedFraction(single, '2026-04-02', linearCurve);
    expect(s).toBeCloseTo(0.156, 2);
    expect(l).toBeGreaterThan(s);
    expect(l).toBeCloseTo(0.25, 2);
  });

  it('sCurve y linearCurve cumplen los invariantes de una curva de avance', () => {
    for (const curve of [sCurve, linearCurve]) {
      expect(curve(0)).toBe(0);
      expect(curve(1)).toBe(1);
      // Monotonía en una malla.
      let prev = -Infinity;
      for (let t = 0; t <= 1.00001; t += 0.1) {
        const v = curve(Math.min(t, 1));
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });

  it('plannedValue pondera presupuesto por fracción planificada', () => {
    // Ambos con misma ventana: PV = 1000 × fracción.
    const pv = plannedValue(packages, '2027-01-01');
    expect(pv).toBe(1000);
  });

  it('EV = Σ presupuesto × avance físico; los paquetes sin reporte cuentan 0', () => {
    const map = new Map<string, ProgressEntry>([['a', progress('a', 0.5, 250)]]);
    // a: 400×0.5 = 200; b: sin reporte = 0
    expect(earnedValue(packages, map)).toBe(200);
  });

  it('AC = Σ costo real acumulado; los paquetes sin reporte cuentan 0', () => {
    const map = new Map<string, ProgressEntry>([['a', progress('a', 0.5, 250)]]);
    expect(actualCost(packages, map)).toBe(250);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Agregador computeEvm
// ────────────────────────────────────────────────────────────────────────────

describe('computeEvm — resultado completo', () => {
  it('arma todos los indicadores del caso de referencia', () => {
    const r = computeEvm(REF);
    expect(r.sv).toBe(-100);
    expect(r.cv).toBe(-100);
    expect(r.spi).toBe(0.8);
    expect(r.cpi).toBe(0.8);
    expect(r.eac.cpi).toBe(1250);
    expect(r.eac.budgetRate).toBe(1100);
    expect(r.eac.cpiSpi).toBeCloseTo(1437.5, 6);
    expect(r.etc.cpi).toBe(750);
    expect(r.vac.cpi).toBe(-250);
    expect(r.tcpiBac).toBe(1.2);
    // tcpiEac usa por defecto el EAC 'cpi' (1250): 600/750 = 0.8
    expect(r.tcpiEac).toBe(0.8);
  });

  it('propaga null coherentemente en el arranque (EV=AC=0)', () => {
    const r = computeEvm({ pv: 200, ev: 0, ac: 0, bac: 1000 });
    expect(r.spi).toBe(0);
    expect(r.cpi).toBeNull();
    expect(r.eac.cpi).toBeNull();
    expect(r.eac.cpiSpi).toBeNull();
    expect(r.eac.budgetRate).toBe(1000);
    expect(r.etc.cpi).toBeNull();
    expect(r.vac.cpi).toBeNull();
    expect(r.tcpiEac).toBeNull(); // depende del EAC 'cpi' que es null
    expect(r.tcpiBac).toBeCloseTo(1.0, 6); // (1000−0)/(1000−0)
  });

  it('permite elegir el método de EAC para tcpiEac', () => {
    const r = computeEvm(REF, { tcpiEacMethod: 'budgetRate' });
    // EAC budgetRate = 1100 ⇒ tcpiEac = 600 / (1100 − 500) = 1.0
    expect(r.tcpiEac).toBe(1);
  });

  it('ningún indicador numérico es NaN o Infinity en los casos borde', () => {
    const bordes: EvmInputs[] = [
      { pv: 0, ev: 0, ac: 0, bac: 0 },
      { pv: 0, ev: 100, ac: 0, bac: 1000 },
      { pv: 1000, ev: 1000, ac: 1000, bac: 1000 },
    ];
    for (const inp of bordes) {
      const r = computeEvm(inp);
      const numbers = [r.sv, r.cv, r.spi, r.cpi, r.tcpiBac, r.tcpiEac];
      for (const value of numbers) {
        if (value !== null) {
          expect(Number.isNaN(value)).toBe(false);
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });
});
