import { useState } from 'react';
import {
  DEFAULT_THRESHOLDS,
  STAGE_BOUNDS,
  STAGE_LABEL,
  type Stage,
  type ThresholdConfig,
} from '../../analytics/status';
import { usePmStore } from '../../store/pmStore';
import { Modal } from '../components/Modal';
import { Button } from '../components/fields';

const STAGES: Stage[] = ['inicial', 'intermedia', 'final'];

const RANGO: Record<Stage, string> = {
  inicial: `0 – ${Math.round(STAGE_BOUNDS.inicial * 100)}% avance`,
  intermedia: `${Math.round(STAGE_BOUNDS.inicial * 100)} – ${Math.round(STAGE_BOUNDS.intermedia * 100)}% avance`,
  final: `${Math.round(STAGE_BOUNDS.intermedia * 100)} – 100% avance`,
};

/** ¿La tabla que edita el usuario es exactamente la de fábrica? */
function esDefault(t: ThresholdConfig): boolean {
  return STAGES.every(
    (s) =>
      t[s].atencion === DEFAULT_THRESHOLDS[s].atencion &&
      t[s].desvio === DEFAULT_THRESHOLDS[s].desvio
  );
}

/** Valida: 0 < desvío ≤ atención ≤ 1.2 en cada etapa. */
function valido(t: ThresholdConfig): boolean {
  return STAGES.every((s) => {
    const { atencion, desvio } = t[s];
    return (
      Number.isFinite(atencion) &&
      Number.isFinite(desvio) &&
      desvio > 0 &&
      desvio <= atencion &&
      atencion <= 1.2
    );
  });
}

/**
 * Configuración de umbrales SPI/CPI por etapa del proyecto.
 *
 * La idea de fondo: un mismo índice no significa lo mismo al 10 % que al 80 %
 * de avance. Al arranque hay ruido y margen para corregir; sobre el final el
 * desvío es casi irreversible. Por eso la tolerancia se puede estrechar por
 * etapa (el criterio del ISR del Banco Mundial y el PMR del BID). Los cambios
 * se guardan en el navegador y recalculan el tablero al instante.
 */
export function ThresholdsModal({ onClose }: { onClose: () => void }) {
  const thresholds = usePmStore((s) => s.thresholds);
  const setThresholds = usePmStore((s) => s.setThresholds);

  const [draft, setDraft] = useState<ThresholdConfig>(() =>
    JSON.parse(JSON.stringify(thresholds))
  );

  function edit(stage: Stage, campo: 'atencion' | 'desvio', valor: string) {
    const n = Number(valor);
    setDraft((d) => ({ ...d, [stage]: { ...d[stage], [campo]: n } }));
  }

  const ok = valido(draft);

  function guardar() {
    if (!ok) return;
    setThresholds(draft);
    onClose();
  }

  return (
    <Modal title="Umbrales por etapa del proyecto" onClose={onClose} wide>
      <p className="text-[14px] leading-relaxed text-muted">
        Cómo se clasifica cada índice (SPI y CPI) según el avance del proyecto. Por encima del
        umbral de <strong className="text-ink">atención</strong> está{' '}
        <span className="font-600 text-onplan">en plan</span>; entre atención y{' '}
        <strong className="text-ink">desvío</strong>, requiere{' '}
        <span className="font-600 text-amber">atención</span>; por debajo de desvío, hay{' '}
        <span className="font-600 text-deviation">desvío</span>. La tolerancia se estrecha a
        medida que el proyecto avanza.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-tech">
              <th className="py-2 pr-4 font-500">Etapa</th>
              <th className="py-2 pr-4 font-500">Rango de avance</th>
              <th className="py-2 pr-4 text-right font-500">Atención ≥</th>
              <th className="py-2 text-right font-500">Desvío &lt;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {STAGES.map((s) => {
              const err = draft[s].desvio > draft[s].atencion;
              return (
                <tr key={s}>
                  <td className="py-2 pr-4 font-600 capitalize text-ink">{STAGE_LABEL[s]}</td>
                  <td className="py-2 pr-4 text-muted">{RANGO[s]}</td>
                  <td className="py-2 pr-4 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1.2"
                      value={draft[s].atencion}
                      onChange={(e) => edit(s, 'atencion', e.target.value)}
                      className={`num w-24 rounded-md border bg-white px-2 py-1 text-right text-ink outline-none focus:ring-1 focus:ring-accent ${
                        err ? 'border-deviation focus:border-deviation' : 'border-line focus:border-accent'
                      }`}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1.2"
                      value={draft[s].desvio}
                      onChange={(e) => edit(s, 'desvio', e.target.value)}
                      className={`num w-24 rounded-md border bg-white px-2 py-1 text-right text-ink outline-none focus:ring-1 focus:ring-accent ${
                        err ? 'border-deviation focus:border-deviation' : 'border-line focus:border-accent'
                      }`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!ok && (
        <p className="mt-2 text-[12px] text-deviation">
          En cada etapa el umbral de desvío debe ser menor o igual al de atención, ambos entre 0
          y 1.2.
        </p>
      )}

      <p className="mt-3 text-[12px] leading-snug text-tech/80">
        Ejemplo: con los valores de fábrica, un CPI de 0.93 al 15 % de avance queda en{' '}
        <span className="font-600 text-amber">atención</span>; el mismo 0.93 al 85 % ya es{' '}
        <span className="font-600 text-deviation">desvío</span>, porque queda poco margen para
        recuperarlo.
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          onClick={() => setDraft(JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS)))}
          disabled={esDefault(draft)}
        >
          Restaurar valores de fábrica
        </Button>
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} disabled={!ok}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
