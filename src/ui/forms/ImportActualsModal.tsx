import { useMemo, useState } from 'react';
import type { Project, WorkPackage } from '../../core/types';
import { usePmStore } from '../../store/pmStore';
import { downloadCsv } from '../export';
import { actualsTemplateCsv, parseActuals } from '../import';
import { Modal } from '../components/Modal';
import { Button } from '../components/fields';
import { money, pct } from '../format';

/**
 * Import de avances y costos reales desde CSV (patrón ERP → EVM). Empareja cada
 * fila con un paquete por nombre; previsualiza y valida antes de crear/actualizar
 * los cortes.
 */
export function ImportActualsModal({
  project,
  workPackages,
  onClose,
}: {
  project: Project;
  workPackages: WorkPackage[];
  onClose: () => void;
}) {
  const importProgress = usePmStore((s) => s.importProgress);
  const [text, setText] = useState('');

  const result = useMemo(
    () => (text.trim() ? parseActuals(text, workPackages) : null),
    [text, workPackages]
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
  }

  async function importar() {
    if (!result) return;
    const drafts = result.rows.filter((r) => r.draft).map((r) => r.draft!);
    if (drafts.length === 0) return;
    await importProgress(drafts);
    onClose();
  }

  return (
    <Modal title={`Importar avances / costos · ${project.nombre}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-md border border-line bg-bg/60 px-4 py-3 text-[13px] text-muted">
          Pegá o subí un CSV con columnas <span className="num text-ink">paquete, fecha, avance,
          costo</span>. El <span className="num text-ink">avance</span> va en % (0–100) y el{' '}
          <span className="num text-ink">costo</span> es acumulado (ACWP). Cada fila es un corte;
          si ya existe uno de ese paquete y fecha, se sobrescribe.
          <button
            className="ml-2 text-accent underline hover:text-ink"
            onClick={() => downloadCsv('plantilla-avances.csv', actualsTemplateCsv())}
          >
            Descargar plantilla
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-[13px] text-muted" />
          <span className="text-[12px] text-muted">o pegá el contenido abajo</span>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="paquete,fecha,avance,costo&#10;Ingeniería de detalle,2026-06-30,100,910000"
          className="num w-full rounded-md border border-line bg-white px-3 py-2 text-[12px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />

        {result?.errorGeneral && (
          <p className="rounded-md border border-deviation/50 bg-deviation/10 px-4 py-2 text-[13px] text-deviation">
            {result.errorGeneral}
          </p>
        )}

        {result && !result.errorGeneral && (
          <>
            <div className="text-[13px] text-muted">
              <span className="font-600 text-onplan">{result.validas}</span> corte(s) válidos
              {result.rows.length - result.validas > 0 && (
                <span className="text-deviation"> · {result.rows.length - result.validas} con error</span>
              )}
            </div>
            <div className="max-h-64 overflow-auto rounded-md border border-line">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead className="sticky top-0 bg-bg/90">
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-tech">
                    <th className="px-3 py-2 font-500">Fila</th>
                    <th className="px-3 py-2 font-500">Fecha</th>
                    <th className="px-3 py-2 text-right font-500">Avance</th>
                    <th className="px-3 py-2 text-right font-500">Costo</th>
                    <th className="px-3 py-2 font-500">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {result.rows.map((r, i) => (
                    <tr key={i} className={r.draft ? '' : 'bg-deviation/5'}>
                      <td className="px-3 py-1.5 text-ink">{r.raw.join(' | ')}</td>
                      <td className="num px-3 py-1.5 text-[12px] text-muted">{r.draft?.fechaCorte ?? '—'}</td>
                      <td className="num px-3 py-1.5 text-right text-ink">
                        {r.draft ? pct(r.draft.avanceFisico) : '—'}
                      </td>
                      <td className="num px-3 py-1.5 text-right text-ink">
                        {r.draft ? money(r.draft.costoRealAcum, project.moneda) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-[12px]">
                        {r.draft ? (
                          <span className="text-onplan">OK</span>
                        ) : (
                          <span className="text-deviation">{r.errores.join(', ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={importar} disabled={!result || result.validas === 0}>
            Importar {result?.validas ?? 0} corte(s)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
