import type { CurvePoint } from '../../analytics/resolve';
import { plannedValue, sCurve } from '../../core/evm';
import type { Project, WorkPackage } from '../../core/types';
import { money } from '../format';
import { Panel, SectionHead } from './primitives';

const W = 760;
const H = 300;
const PAD = { top: 24, right: 128, bottom: 40, left: 16 };

function isoAtFraction(startIso: string, endIso: string, t: number): string {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  return new Date(start + t * (end - start)).toISOString().slice(0, 10);
}

/**
 * Curva S del proyecto: PV planificado a lo largo de todo el cronograma, más
 * las curvas reales de EV (ganado) y AC (real) construidas con la historia de
 * cortes hasta la fecha seleccionada. Líneas y puntos, nunca gauges ni donuts;
 * la identidad de cada serie va por etiqueta directa.
 */
export function SCurveChart({
  project,
  workPackages,
  dataDate,
  history,
}: {
  project: Project;
  workPackages: readonly WorkPackage[];
  dataDate: string;
  history: CurvePoint[];
}) {
  const cur = project.moneda;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const startMs = Date.parse(project.fechaInicio);
  const endMs = Date.parse(project.fechaFinPlan);
  const span = endMs - startMs || 1;

  const tOf = (iso: string) => (Date.parse(iso) - startMs) / span;
  const x = (t: number) => PAD.left + Math.max(0, Math.min(1, t)) * plotW;
  const y = (v: number) => PAD.top + (1 - v / project.bac) * plotH;

  // Curva S de PV a lo largo del cronograma completo.
  const N = 48;
  const pvPts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const date = isoAtFraction(project.fechaInicio, project.fechaFinPlan, t);
    pvPts.push(`${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)},${y(plannedValue(workPackages, date, sCurve)).toFixed(1)}`);
  }
  const pvPath = pvPts.join(' ');

  // Polilíneas reales de EV y AC (historia de cortes).
  const lineFor = (sel: (p: CurvePoint) => number) =>
    history.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(tOf(p.date)).toFixed(1)},${y(sel(p)).toFixed(1)}`).join(' ');
  const evPath = lineFor((p) => p.ev);
  const acPath = lineFor((p) => p.ac);

  const nowX = x(tOf(dataDate));
  const last = history[history.length - 1];
  const pvNow = last?.pv ?? 0;
  const evNow = last?.ev ?? 0;
  const acNow = last?.ac ?? 0;

  const series = [
    { key: 'pv', label: 'PV · planificado', value: pvNow, color: '#256B7E' },
    { key: 'ev', label: 'EV · ganado', value: evNow, color: '#10222A' },
    { key: 'ac', label: 'AC · real', value: acNow, color: '#B07314' },
  ];

  // Reparto vertical de las etiquetas por su altura real, evitando solapes.
  const labelX = PAD.left + plotW + 12;
  const GAP = 30;
  const placed = [...series]
    .map((s) => ({ ...s, dotY: y(s.value), labelY: y(s.value) }))
    .sort((a, b) => a.labelY - b.labelY);
  for (let i = 1; i < placed.length; i++) {
    if (placed[i]!.labelY < placed[i - 1]!.labelY + GAP) placed[i]!.labelY = placed[i - 1]!.labelY + GAP;
  }

  return (
    <Panel>
      <SectionHead eyebrow="Curva S" title="Valor planificado, ganado y real" aside={`corte ${dataDate}`} />
      <div className="px-3 py-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Curva S del proyecto">
          {/* BAC (tope) y baseline. */}
          <line x1={PAD.left} y1={y(project.bac)} x2={PAD.left + plotW} y2={y(project.bac)} stroke="#C3CDD4" strokeDasharray="3 4" />
          <text x={PAD.left} y={y(project.bac) - 6} className="num" fontSize="11" fill="#256B7E">
            BAC {money(project.bac, cur)}
          </text>
          <line x1={PAD.left} y1={y(0)} x2={PAD.left + plotW} y2={y(0)} stroke="#C3CDD4" />

          {/* Fecha de corte. */}
          <line x1={nowX} y1={PAD.top} x2={nowX} y2={y(0)} stroke="#C3CDD4" />
          <text x={nowX} y={H - PAD.bottom + 20} fontSize="11" fill="#58696F" textAnchor="middle">
            corte
          </text>

          {/* PV (baseline S), EV y AC. */}
          <path d={pvPath} fill="none" stroke="#256B7E" strokeWidth="2" strokeDasharray="5 3" />
          <path d={acPath} fill="none" stroke="#B07314" strokeWidth="2" />
          <path d={evPath} fill="none" stroke="#10222A" strokeWidth="2" />

          {/* Marcadores en cada corte histórico. */}
          {history.map((p) => (
            <g key={p.date}>
              <circle cx={x(tOf(p.date))} cy={y(p.ac)} r="2.6" fill="#B07314" />
              <circle cx={x(tOf(p.date))} cy={y(p.ev)} r="2.6" fill="#10222A" />
            </g>
          ))}

          {/* Puntos y etiquetas a la fecha de corte. */}
          {placed.map((s) => (
            <g key={s.key}>
              <path d={`M${nowX},${s.dotY} L${labelX - 6},${s.labelY - 3}`} fill="none" stroke="#C3CDD4" strokeWidth="1" />
              <circle cx={nowX} cy={s.dotY} r="4.5" fill={s.color} stroke="#FFFFFF" strokeWidth="2" />
              <text x={labelX} y={s.labelY - 3} fontSize="12" fill={s.color}>
                <tspan className="num" fontWeight="600">
                  {money(s.value, cur)}
                </tspan>
              </text>
              <text x={labelX} y={s.labelY + 10} fontSize="10" fill="#58696F">
                {s.label}
              </text>
            </g>
          ))}
        </svg>
        <p className="px-2 text-[12px] leading-snug text-tech/80">
          La línea teal es el plan de devengamiento (perfil S). EV por debajo de PV es atraso; AC por
          encima de EV es sobrecosto.
        </p>
      </div>
    </Panel>
  );
}
