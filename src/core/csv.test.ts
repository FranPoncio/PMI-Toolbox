import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvLine, parseLocaleDate, parseLocaleNumber } from './csv';

describe('parseCsvLine', () => {
  it('separa por coma y recorta espacios', () => {
    expect(parseCsvLine('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('respeta comillas con comas y comillas escapadas', () => {
    expect(parseCsvLine('"Tendido, soldadura","dijo ""ok""",3')).toEqual([
      'Tendido, soldadura',
      'dijo "ok"',
      '3',
    ]);
  });

  it('soporta separador punto y coma', () => {
    expect(parseCsvLine('a;b;c', ';')).toEqual(['a', 'b', 'c']);
  });
});

describe('parseCsv', () => {
  it('detecta el separador y omite líneas vacías', () => {
    const rows = parseCsv('n;p\n\na;1\nb;2\n');
    expect(rows).toEqual([
      ['n', 'p'],
      ['a', '1'],
      ['b', '2'],
    ]);
  });
});

describe('parseLocaleNumber', () => {
  it('formato es-AR con miles y decimal', () => {
    expect(parseLocaleNumber('1.234.567,89')).toBeCloseTo(1234567.89, 2);
  });
  it('formato anglo con miles y decimal', () => {
    expect(parseLocaleNumber('1,234,567.89')).toBeCloseTo(1234567.89, 2);
  });
  it('coma como decimal', () => {
    expect(parseLocaleNumber('4200,5')).toBeCloseTo(4200.5, 2);
  });
  it('coma como miles (3 decimales aparentes)', () => {
    expect(parseLocaleNumber('4,200')).toBe(4200);
  });
  it('con símbolo de moneda y espacios', () => {
    expect(parseLocaleNumber('US$ 6.800.000')).toBe(6800000);
  });
  it('entero simple', () => {
    expect(parseLocaleNumber('850000')).toBe(850000);
  });
  it('vacío o inválido ⇒ null', () => {
    expect(parseLocaleNumber('')).toBeNull();
    expect(parseLocaleNumber('n/a')).toBeNull();
  });
});

describe('parseLocaleDate', () => {
  it('acepta ISO', () => {
    expect(parseLocaleDate('2026-03-31')).toBe('2026-03-31');
  });
  it('acepta DD/MM/YYYY', () => {
    expect(parseLocaleDate('31/03/2026')).toBe('2026-03-31');
    expect(parseLocaleDate('1/9/2025')).toBe('2025-09-01');
  });
  it('acepta DD-MM-YY', () => {
    expect(parseLocaleDate('05-11-26')).toBe('2026-11-05');
  });
  it('rechaza fechas imposibles', () => {
    expect(parseLocaleDate('31/02/2026')).toBeNull();
    expect(parseLocaleDate('foo')).toBeNull();
    expect(parseLocaleDate('')).toBeNull();
  });
});
