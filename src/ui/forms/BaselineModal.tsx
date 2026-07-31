import { useState } from 'react';
import type { BaselineDivergence } from '../../analytics/baseline';
import type { Baseline, Project } from '../../core/types';
import { usePmStore } from '../../store/pmStore';
import { Modal } from '../components/Modal';
import { Button, Field, TextInput } from '../components/fields';
import { money } from '../format';

const HOY = new Date().toISOString().slice(0, 10);

/**
 * Gestión de la línea base: muestra la vigente y su divergencia con la
 * estructura viva, permite congelar una nueva versión (rebaselining) y lista el
 * historial completo para auditoría.
 */
export function BaselineModal({
  project,
  baseline,
  baselines,
  divergence,
  onClose,
}: {
  project: Project;
  baseline: Baseline | undefined;
  baselines: Baseline[];
  divergence: BaselineDivergence;
  onClose: () => void;
}) {
  const freezeBaseline = usePmStore((s) => s.freezeBaseline);
  const removeBaseline = usePmStore((s) => s.removeBaseline);
  const cur = project.moneda;
  const nextVersion = baselines.reduce((max, b) => Math.max(max, b.version), 0) + 1;

  const [fecha, setFecha] = useState(HOY);
  const [motivo, setMotivo] = useState('');

  async function congelar(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha) return;
    await freezeBaseline(fecha, motivo.trim() || (nextVersion === 1 ? 'Línea base inicial' : 'Rebaseline'));
    onClose();
  }

  return (
    <Modal title={`Línea base · ${project.nombre}`} onClose={onClose} wide>
      {/* Estado actual. */}
      {baseline ? (
        <div className="rounded-md border border-line bg-bg/60 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[14px] font-600 text-ink">
              Línea base vigente: v{baseline.version}
            </span>
            <span className="num text-[13px] text-muted">
              {baseline.fechaAprobacion} · BAC {money(baseline.bac, cur)} · {baseline.items.length} paquetes
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">{baseline.motivo}</p>
        </div>
      ) : (
        <div className="rounded-md border border-line bg-bg/60 px-4 py-3 text-[13px] text-muted">
          El proyecto todavía no tiene línea base. Mientras tanto, el desempeño se
          mide contra el plan vivo como referencia provisoria. Congelá una para
          fijar la base de medición.
        </div>
      )}

      {/* Divergencia. */}
      {baseline && divergence.cambio && (
        <div className="mt-3 rounded-md border border-amber/50 bg-amber/10 px-4 py-3 text-[13px] text-ink">
          <div className="font-600 text-amber">La estructura cambió respecto de la línea base</div>
          <ul className="mt-1 list-inside list-disc text-muted">
            {divergence.modificados.length > 0 && (
              <li>Modificados: {divergence.modificados.join(', ')}</li>
            )}
            {divergence.agregados.length > 0 && <li>Agregados: {divergence.agregados.join(', ')}</li>}
            {divergence.quitados.length > 0 && <li>Quitados: {divergence.quitados.join(', ')}</li>}
          </ul>
          <p className="mt-1 text-[12px] text-muted">
            Considerá congelar una nueva versión para que la medición refleje el alcance actual.
          </p>
        </div>
      )}

      {/* Congelar nueva versión. */}
      <form onSubmit={congelar} className="mt-4 rounded-md border border-line px-4 py-3">
        <div className="mb-2 text-[13px] font-600 text-ink">
          Congelar línea base v{nextVersion}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
          <Field label="Fecha de aprobación">
            <TextInput type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Motivo">
            <TextInput
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={nextVersion === 1 ? 'Línea base inicial aprobada' : 'Motivo del rebaseline'}
            />
          </Field>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Toma la foto del plan actual ({project.nombre}): presupuesto, pesos y fechas de cada
          paquete. La versión anterior se conserva como histórico.
        </p>
        <div className="mt-3 flex justify-end">
          <Button type="submit" variant="primary">
            Congelar v{nextVersion}
          </Button>
        </div>
      </form>

      {/* Historial. */}
      {baselines.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-[11px] font-600 uppercase tracking-wider text-tech">Historial</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-tech">
                  <th className="py-2 pr-4 font-500">Versión</th>
                  <th className="py-2 pr-4 font-500">Aprobación</th>
                  <th className="py-2 pr-4 font-500">Motivo</th>
                  <th className="py-2 pr-4 text-right font-500">BAC</th>
                  <th className="py-2 font-500" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {[...baselines]
                  .sort((a, b) => b.version - a.version)
                  .map((b) => (
                    <tr key={b.id}>
                      <td className="num py-2 pr-4 text-ink">
                        v{b.version}
                        {b.activa && (
                          <span className="ml-2 rounded-full border border-onplan/50 bg-onplan/10 px-1.5 py-0.5 text-[10px] text-onplan">
                            activa
                          </span>
                        )}
                      </td>
                      <td className="num py-2 pr-4 text-muted">{b.fechaAprobacion}</td>
                      <td className="py-2 pr-4 text-muted">{b.motivo}</td>
                      <td className="num py-2 pr-4 text-right text-ink">{money(b.bac, cur)}</td>
                      <td className="py-2 text-right">
                        <Button
                          variant="danger"
                          onClick={async () => {
                            if (confirm(`¿Borrar la línea base v${b.version}?`)) await removeBaseline(b.id);
                          }}
                        >
                          Borrar
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  );
}
