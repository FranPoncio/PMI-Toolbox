import { classifyIndex } from '../../analytics/status';
import type { ScheduleForecast } from '../../analytics/schedule';
import { usePmStore } from '../../store/pmStore';
import { index, indexDelta, months, signedMonths } from '../format';
import { STATUS_STYLE } from '../statusColor';
import { Panel, SectionHead } from './primitives';

/**
 * Pronóstico de plazo por Earned Schedule. A diferencia del SV en dinero (que
 * al final del proyecto siempre tiende a 0), acá el atraso se expresa en tiempo
 * y se proyecta una fecha de fin, comparada siempre contra el plan.
 */
export function SchedulePanel({
  forecast,
  completion,
}: {
  forecast: ScheduleForecast;
  /** Avance físico consolidado (0..1), para aplicar los umbrales de la etapa. */
  completion?: number;
}) {
  const thresholds = usePmStore((s) => s.thresholds);
  const status = classifyIndex(forecast.spit, completion, thresholds);
  const s = STATUS_STYLE[status];

  const atrasado = forecast.atrasoMeses !== null && forecast.atrasoMeses > 0.1;
  const adelantado = forecast.atrasoMeses !== null && forecast.atrasoMeses < -0.1;

  let titular: string;
  if (forecast.fechaFinPronosticada === null) {
    titular = 'Todavía no hay avance suficiente para pronosticar la fecha de fin.';
  } else if (atrasado) {
    titular = `Al ritmo actual, el proyecto terminaría el ${forecast.fechaFinPronosticada} — ${signedMonths(
      forecast.atrasoMeses
    )} respecto del plan (${forecast.fechaFinPlan}).`;
  } else if (adelantado) {
    titular = `Al ritmo actual, el proyecto terminaría el ${forecast.fechaFinPronosticada}, adelantado ${signedMonths(
      forecast.atrasoMeses
    )} respecto del plan (${forecast.fechaFinPlan}).`;
  } else {
    titular = `Al ritmo actual, el proyecto terminaría en fecha (${forecast.fechaFinPlan}).`;
  }

  return (
    <Panel>
      <SectionHead
        eyebrow="Plazo"
        title="Pronóstico de fin — Earned Schedule"
        aside={`ES ${months(forecast.esMonths)} de ${months(forecast.pdMonths)}`}
      />
      <p className="border-b border-line px-5 py-3 text-[14px] leading-relaxed text-ink">{titular}</p>
      <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Cell
          label="Fin planificado"
          value={forecast.fechaFinPlan}
          sub="línea base"
          subClass="text-muted"
        />
        <Cell
          label="Fin pronosticado"
          value={forecast.fechaFinPronosticada ?? '—'}
          sub={`${signedMonths(forecast.atrasoMeses)} vs plan`}
          subClass={s.text}
        />
        <Cell
          label="SPI(t) — desempeño de plazo"
          value={index(forecast.spit)}
          mono
          sub={`SV(t) ${signedMonths(forecast.svtMonths)} · Δ ${indexDelta(forecast.spit)}`}
          subClass={s.text}
        />
      </div>
    </Panel>
  );
}

function Cell({
  label,
  value,
  sub,
  subClass,
  mono = false,
}: {
  label: string;
  value: string;
  sub: string;
  subClass: string;
  mono?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-600 uppercase tracking-[0.12em] text-tech">{label}</div>
      <div className={`mt-1.5 text-2xl font-500 text-ink ${mono ? 'num' : 'num'}`}>{value}</div>
      <div className={`num mt-0.5 text-[13px] ${subClass}`}>{sub}</div>
    </div>
  );
}
