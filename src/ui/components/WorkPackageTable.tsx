import type { WorkPackageAnalysis } from '../../analytics/decisions';
import { STATUS_STYLE } from '../statusColor';
import { index, indexDelta, money, pct } from '../format';
import { Panel, SectionHead, StatusPill } from './primitives';

/** Barra de avance real con una marca de avance planificado a la fecha. */
function ProgressVsPlan({ real, plan }: { real: number; plan: number }) {
  const r = Math.max(0, Math.min(1, real));
  const p = Math.max(0, Math.min(1, plan));
  const behind = r < p - 0.02;
  return (
    <div className="relative h-2 w-28 rounded-full bg-bg ring-1 ring-inset ring-line">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${r * 100}%`, backgroundColor: behind ? '#BC4327' : '#27795A' }}
      />
      {/* Marca de plan. */}
      <div
        className="absolute inset-y-[-2px] w-[2px] bg-ink"
        style={{ left: `calc(${p * 100}% - 1px)` }}
        title={`Plan: ${pct(plan)}`}
      />
    </div>
  );
}

function IndexCell({ value }: { value: number | null }) {
  const status =
    value === null
      ? 'sin-dato'
      : value >= 0.98
        ? 'onplan'
        : value >= 0.9
          ? 'atencion'
          : 'desvio';
  const s = STATUS_STYLE[status];
  return (
    <span className="num inline-flex flex-col items-end leading-tight">
      <span className={`${s.text} font-600`}>{index(value)}</span>
      <span className="text-[11px] text-tech/70">{indexDelta(value)}</span>
    </span>
  );
}

/**
 * Tabla de paquetes de trabajo. Ningún valor va solo: el avance se muestra
 * contra el plan, y SPI/CPI contra 1.00. Se ordena por exposición para que lo
 * más comprometido quede arriba.
 */
export function WorkPackageTable({
  packages,
  currency,
}: {
  packages: WorkPackageAnalysis[];
  currency: string;
}) {
  const rows = [...packages].sort((a, b) => b.exposicion - a.exposicion);

  return (
    <Panel>
      <SectionHead eyebrow="Detalle" title="Paquetes de trabajo" aside={`${rows.length} paquetes`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-tech/70">
              <th className="px-5 py-2 font-500">Paquete</th>
              <th className="py-2 pr-4 font-500">Avance vs plan</th>
              <th className="py-2 pr-4 text-right font-500">SPI</th>
              <th className="py-2 pr-4 text-right font-500">CPI</th>
              <th className="py-2 pr-4 text-right font-500">EAC vs BAC</th>
              <th className="py-2 pr-5 text-right font-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map((a) => {
              const real = a.inputs.ev / a.inputs.bac;
              const plan = a.inputs.pv / a.inputs.bac;
              const vac = a.evm.vac.cpi;
              return (
                <tr key={a.wp.id} className="align-middle">
                  <td className="px-5 py-3">
                    <div className="font-500 text-ink">{a.wp.nombre}</div>
                    <div className="text-[12px] text-tech/80">{a.wp.responsable}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <ProgressVsPlan real={real} plan={plan} />
                      <span className="num text-[12px] text-tech">
                        {pct(real)} <span className="text-tech/60">/ {pct(plan)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <IndexCell value={a.evm.spi} />
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <IndexCell value={a.evm.cpi} />
                  </td>
                  <td className="num py-3 pr-4 text-right">
                    {a.evm.eac.cpi === null ? (
                      <span className="text-tech/60">—</span>
                    ) : (
                      <span className="inline-flex flex-col items-end leading-tight">
                        <span className="text-ink">{money(a.evm.eac.cpi, currency)}</span>
                        <span
                          className="text-[11px]"
                          style={{ color: vac !== null && vac < 0 ? '#BC4327' : '#58696F' }}
                        >
                          {vac === null ? '' : vac < 0 ? `+${money(-vac, currency)}` : 'en presupuesto'}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-5 text-right">
                    <StatusPill status={a.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
