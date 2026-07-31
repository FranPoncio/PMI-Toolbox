import { describe, expect, it } from 'vitest';
import {
  earnedScheduleFraction,
  independentEacTime,
  scheduleVarianceTime,
  spiTime,
} from './earnedSchedule';

const BAC = 1000;
const linear = (t: number) => t * BAC;
// Curva S (smoothstep), la que usa el PV por defecto.
const sCurve = (t: number) => t * t * (3 - 2 * t) * BAC;

describe('earnedScheduleFraction', () => {
  it('curva lineal: ES es proporcional al EV', () => {
    expect(earnedScheduleFraction(linear, 500, BAC)).toBeCloseTo(0.5, 3);
    expect(earnedScheduleFraction(linear, 250, BAC)).toBeCloseTo(0.25, 3);
  });

  it('curva S: mismo EV cae en un t distinto que en lineal', () => {
    // sCurve(0.5) = 0.5·BAC, así que EV=500 sigue dando t=0.5 por simetría.
    expect(earnedScheduleFraction(sCurve, 500, BAC)).toBeCloseTo(0.5, 3);
    // Pero EV=156.25 (=sCurve(0.25)) da t=0.25, no 0.156.
    expect(earnedScheduleFraction(sCurve, 156.25, BAC)).toBeCloseTo(0.25, 2);
  });

  it('bordes: EV≤0 ⇒ 0; EV≥BAC ⇒ 1', () => {
    expect(earnedScheduleFraction(linear, 0, BAC)).toBe(0);
    expect(earnedScheduleFraction(linear, -10, BAC)).toBe(0);
    expect(earnedScheduleFraction(linear, BAC, BAC)).toBe(1);
    expect(earnedScheduleFraction(linear, BAC + 10, BAC)).toBe(1);
  });
});

describe('índices de tiempo', () => {
  it('SPI(t) = ES / AT; null si AT=0', () => {
    expect(spiTime(4, 5)).toBeCloseTo(0.8, 6); // atrasado
    expect(spiTime(6, 5)).toBeCloseTo(1.2, 6); // adelantado
    expect(spiTime(3, 0)).toBeNull();
  });

  it('SV(t) = ES − AT', () => {
    expect(scheduleVarianceTime(4, 5)).toBe(-1);
    expect(scheduleVarianceTime(6, 5)).toBe(1);
  });

  it('IEAC(t) = PD / SPI(t); null si SPI(t) es null o 0', () => {
    // PD=12, SPI(t)=0.8 ⇒ 15 meses.
    expect(independentEacTime(12, 0.8)).toBeCloseTo(15, 6);
    expect(independentEacTime(12, null)).toBeNull();
    expect(independentEacTime(12, 0)).toBeNull();
  });
});
