/**
 * Utilidades puras de parsing de CSV y de valores locales (números y fechas),
 * pensadas para importar cronogramas exportados desde Excel / MS Project / P6.
 * Sin dependencias, testeables de forma aislada.
 */

/** Tokeniza una línea CSV respetando comillas dobles. Separador coma o `;`. */
export function parseCsvLine(line: string, sep = ','): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Parsea un CSV completo en filas de celdas. Detecta el separador (`,` o `;`)
 * por la primera línea (el que más aparezca). Ignora líneas vacías.
 */
export function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const first = lines[0]!;
  const sep = (first.split(';').length > first.split(',').length ? ';' : ',') as ',' | ';';
  return lines.map((l) => parseCsvLine(l, sep));
}

/**
 * Parsea un número tolerando símbolos, espacios y separadores de miles/decimal
 * en formato local (es-AR: "1.234.567,89") o anglo ("1,234,567.89").
 * Devuelve `null` si no hay un número válido.
 */
export function parseLocaleNumber(raw: string): number | null {
  let s = raw.trim().replace(/[^\d.,-]/g, '');
  if (s === '' || s === '-') return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // El último separador que aparece es el decimal.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.'); // es-AR
    } else {
      s = s.replace(/,/g, ''); // anglo
    }
  } else if (hasComma) {
    const decimals = s.length - s.lastIndexOf(',') - 1;
    s = decimals > 0 && decimals <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (hasDot) {
    // Varios puntos ⇒ separadores de miles; un punto con 3 decimales aparentes
    // (grupo de miles) también. Con 1-2 decimales, es decimal (se deja).
    const dots = (s.match(/\./g) ?? []).length;
    const decimals = s.length - s.lastIndexOf('.') - 1;
    if (dots > 1 || decimals === 3) s = s.replace(/\./g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Rellena a 2 dígitos. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Parsea una fecha a ISO `YYYY-MM-DD`. Acepta ISO, `DD/MM/YYYY` y `DD-MM-YYYY`
 * (con año de 2 o 4 dígitos). Devuelve `null` si no es una fecha válida.
 */
export function parseLocaleDate(raw: string): string | null {
  const s = raw.trim();
  if (s === '') return null;

  // ISO YYYY-MM-DD (o con hora): tomamos los primeros 10.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    return valid(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // DD/MM/YYYY o DD-MM-YYYY.
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return valid(year, Number(dmy[2]), Number(dmy[1]));
  }

  return null;
}

function valid(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}
