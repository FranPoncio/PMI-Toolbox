import { classifyIndex } from '../../analytics/status';
import type { EvmResult } from '../../core/types';
import { index, money, signedMoney } from '../format';
import { Panel, SectionHead } from './primitives';
import { MetricVsPlan } from './primitives';

const EAC_LABEL: Record<string, string> = {
  cpi: 'EAC · CPI (desvío sistémico)',
  budgetRate: 'EAC · presupuesto restante',
  cpiSpi: 'EAC · CPI×SPI (costo y plazo)',
};

/**
 * Resumen EVM consolidado. Cada indicador aparece contra su plan; no hay
 * cifras absolutas sueltas. Las tres variantes de EAC se muestran juntas para
 * que el analista vea el rango de cierre, no un único número.
 */
export function EvmSummary({ evm, currency }: { evm: EvmResult; currency: string }) {
  const spiStatus = classifyIndex(evm.spi);
  const cpiStatus = classifyIndex(evm.cpi);

  return (
    <Panel>
      <SectionHead eyebrow="Consolidado" title="Desempeño contra plan" />
      <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <MetricVsPlan
          label="Avance en valor · EV"
          real={money(evm.ev, currency)}
          plan={money(evm.pv, currency)}
          delta={`SV ${signedMoney(evm.sv, currency)}`}
          deltaStatus={spiStatus}
          hint={`SPI ${index(evm.spi)} — cuánto trabajo se ganó frente a lo planificado.`}
        />
        <MetricVsPlan
          label="Costo real · AC"
          real={money(evm.ac, currency)}
          plan={money(evm.ev, currency)}
          delta={`CV ${signedMoney(evm.cv, currency)}`}
          deltaStatus={cpiStatus}
          hint={`CPI ${index(evm.cpi)} — cuánto costó frente al valor ganado.`}
        />
        <MetricVsPlan
          label="Proyección a fin · EAC (CPI)"
          real={money(evm.eac.cpi ?? 0, currency)}
          plan={money(evm.bac, currency)}
          delta={`VAC ${signedMoney(evm.vac.cpi, currency)}`}
          deltaStatus={cpiStatus}
          hint={`TCPI ${index(evm.tcpiBac)} para cerrar dentro del presupuesto.`}
        />
      </div>

      {/* Rango de proyección: las tres variantes de EAC lado a lado. */}
      <div className="border-t border-line px-5 py-4">
        <div className="mb-2 text-[11px] font-600 uppercase tracking-[0.12em] text-tech">
          Proyección a fin — tres métodos
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-tech/70">
                <th className="py-1.5 pr-4 font-500">Método</th>
                <th className="py-1.5 pr-4 text-right font-500">EAC</th>
                <th className="py-1.5 pr-4 text-right font-500">ETC (falta)</th>
                <th className="py-1.5 text-right font-500">VAC vs BAC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {(['cpi', 'budgetRate', 'cpiSpi'] as const).map((m) => (
                <tr key={m}>
                  <td className="py-1.5 pr-4 text-muted">{EAC_LABEL[m]}</td>
                  <td className="num py-1.5 pr-4 text-right text-ink">
                    {evm.eac[m] === null ? '—' : money(evm.eac[m]!, currency)}
                  </td>
                  <td className="num py-1.5 pr-4 text-right text-tech">
                    {evm.etc[m] === null ? '—' : money(evm.etc[m]!, currency)}
                  </td>
                  <td className="num py-1.5 text-right text-tech">
                    {signedMoney(evm.vac[m], currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] leading-snug text-tech/80">
          El método CPI asume que el desvío de costo es permanente; el de presupuesto restante,
          que lo que falta se ejecuta al valor original; CPI×SPI pondera también el atraso.
        </p>
      </div>
    </Panel>
  );
}
