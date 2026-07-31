import type { ReactNode } from 'react';
import type { Status } from '../../analytics/status';
import { STATUS_STYLE } from '../statusColor';

/** Panel base: tarjeta blanca con borde nítido y sombra sutil. */
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-md border border-line bg-panel shadow-[0_1px_2px_rgba(16,34,42,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

/** Encabezado de sección con banda gris tipo planilla. */
export function SectionHead({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 rounded-t-md border-b border-line bg-bg/70 px-5 py-3">
      <div>
        <div className="text-[11px] font-600 uppercase tracking-[0.14em] text-tech">{eyebrow}</div>
        <h2 className="text-[15px] font-600 text-ink">{title}</h2>
      </div>
      {aside ? <div className="num text-sm text-muted">{aside}</div> : null}
    </div>
  );
}

/** Pastilla de estado con punto de color + etiqueta (identidad no solo por color). */
export function StatusPill({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${s.border} ${s.bg} px-2 py-0.5 text-[11px] font-500 ${s.text}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
  );
}

/**
 * Métrica siempre contra plan: valor real, valor de plan y la variación.
 * Materializa la regla "ningún número absoluto sin su comparación".
 */
export function MetricVsPlan({
  label,
  real,
  plan,
  delta,
  deltaStatus,
  hint,
}: {
  label: string;
  real: string;
  plan: string;
  delta: string;
  deltaStatus: Status;
  hint?: string;
}) {
  const s = STATUS_STYLE[deltaStatus];
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-600 uppercase tracking-[0.12em] text-tech">{label}</div>
      <div className="num mt-1.5 text-2xl font-500 text-ink">{real}</div>
      <div className="num mt-0.5 text-[13px] text-tech">
        plan {plan} · <span className={s.text}>{delta}</span>
      </div>
      {hint ? <div className="mt-1 text-[12px] leading-snug text-tech/80">{hint}</div> : null}
    </div>
  );
}
