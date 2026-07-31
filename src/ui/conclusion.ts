import type { ProjectAnalysis } from '../analytics/decisions';
import { index, money, signedMoney } from './format';

export interface Conclusion {
  /** Veredicto en una frase. */
  titular: string;
  /** Párrafos de sustento, cada uno con su comparación contra plan. */
  parrafos: string[];
}

/**
 * Redacta la conclusión escrita con que abre la pantalla (regla de diseño:
 * la pantalla abre con texto, no con gráficos). Ningún número aparece sin su
 * comparación contra plan.
 */
export function buildConclusion(a: ProjectAnalysis): Conclusion {
  const cur = a.project.moneda;
  const { evm } = a;

  const atrasado = evm.spi !== null && evm.spi < 0.98;
  const sobrecosto = evm.cpi !== null && evm.cpi < 0.98;

  let titular: string;
  if (atrasado && sobrecosto) {
    titular = 'El proyecto está atrasado y por encima del presupuesto.';
  } else if (sobrecosto) {
    titular = 'El proyecto va en tiempo pero por encima del presupuesto.';
  } else if (atrasado) {
    titular = 'El proyecto está dentro del presupuesto pero atrasado.';
  } else {
    titular = 'El proyecto está dentro de plan en tiempo y costo.';
  }

  const parrafos: string[] = [];

  parrafos.push(
    `A la fecha de corte se ejecutó trabajo por ${money(evm.ev, cur)} contra ${money(
      evm.pv,
      cur
    )} planificado (SPI ${index(evm.spi)}, atraso de ${signedMoney(evm.sv, cur)}), ` +
      `y costó ${money(evm.ac, cur)} (CPI ${index(evm.cpi)}, ${signedMoney(evm.cv, cur)} de variación de costo).`
  );

  if (evm.eac.cpi !== null) {
    parrafos.push(
      `De sostenerse la eficiencia de costo actual, el proyecto cerraría en ${money(
        evm.eac.cpi,
        cur
      )} contra un presupuesto de ${money(a.project.bac, cur)} — ` +
        `un desvío proyectado de ${signedMoney(evm.vac.cpi, cur)} (VAC). ` +
        `Terminar dentro del presupuesto exigiría un TCPI de ${index(evm.tcpiBac)} en lo que resta.`
    );
  }

  const foco = a.decisiones[0];
  if (foco && foco.exposicion > 0) {
    parrafos.push(
      `El mayor foco es «${foco.wpNombre}» (${foco.responsable}), que concentra ${money(
        foco.exposicion,
        cur
      )} del sobrecosto proyectado. Hay ${a.decisiones.length} paquete(s) que requieren decisión, listados abajo por exposición.`
    );
  }

  return { titular, parrafos };
}
