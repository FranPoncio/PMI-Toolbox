import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THRESHOLDS,
  classifyIndex,
  completionOf,
  stageOf,
  worstStatus,
  type ThresholdConfig,
} from './status';

describe('stageOf', () => {
  it('parte por avance físico: inicial / intermedia / final', () => {
    expect(stageOf(0)).toBe('inicial');
    expect(stageOf(0.29)).toBe('inicial');
    expect(stageOf(0.3)).toBe('intermedia');
    expect(stageOf(0.69)).toBe('intermedia');
    expect(stageOf(0.7)).toBe('final');
    expect(stageOf(1)).toBe('final');
  });
});

describe('completionOf', () => {
  it('es EV/BAC y evita la división por cero', () => {
    expect(completionOf(50, 100)).toBe(0.5);
    expect(completionOf(0, 0)).toBe(0);
    expect(completionOf(10, 0)).toBe(0);
  });
});

describe('classifyIndex con umbrales sensibles a la etapa', () => {
  it('null ⇒ sin-dato, sin importar la etapa', () => {
    expect(classifyIndex(null)).toBe('sin-dato');
    expect(classifyIndex(null, 0.9)).toBe('sin-dato');
  });

  it('sin completion usa la etapa intermedia (retrocompatible 0.98/0.90)', () => {
    expect(classifyIndex(1.0)).toBe('onplan');
    expect(classifyIndex(0.98)).toBe('onplan');
    expect(classifyIndex(0.95)).toBe('atencion');
    expect(classifyIndex(0.9)).toBe('atencion');
    expect(classifyIndex(0.89)).toBe('desvio');
  });

  it('el mismo índice endurece su estado a medida que avanza el proyecto', () => {
    const cpi = 0.93;
    // Inicial (más tolerante): 0.93 ≥ 0.85 y < 0.95 ⇒ atención.
    expect(classifyIndex(cpi, 0.15)).toBe('atencion');
    // Intermedia: 0.93 ≥ 0.90 y < 0.98 ⇒ atención.
    expect(classifyIndex(cpi, 0.5)).toBe('atencion');
    // Final (más estricto): 0.93 < 0.95 ⇒ desvío.
    expect(classifyIndex(cpi, 0.85)).toBe('desvio');
  });

  it('un índice alto puede estar en plan al inicio y no al final', () => {
    const spi = 0.96;
    expect(classifyIndex(spi, 0.1)).toBe('onplan'); // ≥ 0.95 inicial
    expect(classifyIndex(spi, 0.5)).toBe('atencion'); // < 0.98 intermedia
    expect(classifyIndex(spi, 0.9)).toBe('atencion'); // ≥ 0.95 pero < 0.99 final
  });

  it('respeta una tabla de umbrales personalizada', () => {
    const custom: ThresholdConfig = {
      inicial: { atencion: 0.9, desvio: 0.8 },
      intermedia: { atencion: 0.9, desvio: 0.8 },
      final: { atencion: 0.9, desvio: 0.8 },
    };
    expect(classifyIndex(0.85, 0.9, custom)).toBe('atencion');
    expect(classifyIndex(0.79, 0.9, custom)).toBe('desvio');
    expect(classifyIndex(0.95, 0.9, custom)).toBe('onplan');
  });

  it('los valores de fábrica se estrechan monótonamente por etapa', () => {
    const { inicial, intermedia, final } = DEFAULT_THRESHOLDS;
    expect(inicial.atencion).toBeLessThanOrEqual(intermedia.atencion);
    expect(intermedia.atencion).toBeLessThanOrEqual(final.atencion);
    expect(inicial.desvio).toBeLessThanOrEqual(intermedia.desvio);
    expect(intermedia.desvio).toBeLessThanOrEqual(final.desvio);
  });
});

describe('worstStatus', () => {
  it('elige el estado más severo', () => {
    expect(worstStatus('onplan', 'atencion', 'desvio')).toBe('desvio');
    expect(worstStatus('onplan', 'atencion')).toBe('atencion');
    expect(worstStatus('onplan', 'sin-dato')).toBe('sin-dato');
    expect(worstStatus('onplan', 'onplan')).toBe('onplan');
  });
});
