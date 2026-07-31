import type { DecisionItem } from '../../analytics/decisions';
import { money } from '../format';
import { STATUS_STYLE } from '../statusColor';
import { Panel, SectionHead, StatusPill } from './primitives';

/**
 * Panel "Requiere decisión". Va arriba de todo, ordenado por exposición
 * económica descendente, y cada ítem trae su motivo explícito. Es lo primero
 * que el analista tiene que poder accionar.
 */
export function DecisionPanel({
  items,
  currency,
}: {
  items: DecisionItem[];
  currency: string;
}) {
  return (
    <Panel>
      <SectionHead
        eyebrow="Prioridad"
        title="Requiere decisión"
        aside={`${items.length} ítem(s) · orden por exposición`}
      />
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-tech">
          No hay paquetes fuera de plan a la fecha de corte.
        </p>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((item, i) => {
            const s = STATUS_STYLE[item.status];
            return (
              <li key={item.wpId} className="flex gap-4 px-5 py-4">
                <div
                  className="num mt-0.5 w-6 shrink-0 text-right text-sm text-tech/70"
                  aria-hidden
                >
                  {i + 1}
                </div>
                {/* Barra de acento a la izquierda para reforzar la severidad sin depender solo del texto. */}
                <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <h3 className="text-[15px] font-600 text-ink">{item.wpNombre}</h3>
                    <div className="flex items-center gap-3">
                      <StatusPill status={item.status} />
                      <span className="text-right">
                        <span className="block text-[10px] uppercase tracking-wider text-tech/70">
                          Exposición
                        </span>
                        <span className={`num text-sm font-600 ${s.text}`}>
                          {item.exposicion > 0 ? money(item.exposicion, currency) : '—'}
                        </span>
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.motivo}</p>
                  <p className="mt-1 text-[12px] text-tech/80">Responsable: {item.responsable}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
