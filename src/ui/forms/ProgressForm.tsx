import { useMemo, useState } from 'react';
import type { ProgressEntry, Project, WorkPackage } from '../../core/types';
import { vigenteByWp } from '../../analytics/resolve';
import { usePmStore } from '../../store/pmStore';
import { Modal } from '../components/Modal';
import { Button, Field, NumberInput, TextInput } from '../components/fields';

interface Row {
  avance: string; // porcentaje 0..100
  costo: string; // costo real acumulado
}

/**
 * Carga de un corte de avance: una fecha, y por cada paquete el % de avance
 * físico y el costo real acumulado. Prefill con el corte vigente a esa fecha
 * para editar sobre lo último cargado.
 */
export function ProgressForm({
  project,
  workPackages,
  progressEntries,
  defaultDate,
  onClose,
}: {
  project: Project;
  workPackages: WorkPackage[];
  progressEntries: ProgressEntry[];
  defaultDate: string;
  onClose: () => void;
}) {
  const saveProgress = usePmStore((s) => s.saveProgress);
  const [fecha, setFecha] = useState(defaultDate || project.fechaInicio);

  const prefill = useMemo(() => vigenteByWp(progressEntries, fecha), [progressEntries, fecha]);
  const [rows, setRows] = useState<Record<string, Row>>(() => initRows(workPackages, prefill));

  // Re-inicializa los valores cuando cambia la fecha (para partir del vigente).
  const [lastFecha, setLastFecha] = useState(fecha);
  if (fecha !== lastFecha) {
    setLastFecha(fecha);
    setRows(initRows(workPackages, vigenteByWp(progressEntries, fecha)));
  }

  function set(wpId: string, patch: Partial<Row>) {
    setRows((r) => ({ ...r, [wpId]: { ...r[wpId]!, ...patch } }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha) return;
    for (const wp of workPackages) {
      const row = rows[wp.id]!;
      if (row.avance === '' && row.costo === '') continue; // sin datos: no crear corte
      const existing = progressEntries.find(
        (p) => p.workPackageId === wp.id && p.fechaCorte === fecha
      );
      const avanceFisico = clamp01((Number(row.avance) || 0) / 100);
      await saveProgress({
        ...(existing ? { id: existing.id } : {}),
        workPackageId: wp.id,
        fechaCorte: fecha,
        avanceFisico,
        costoRealAcum: Number(row.costo) || 0,
      });
    }
    onClose();
  }

  return (
    <Modal title={`Cargar corte · ${project.nombre}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="max-w-xs">
          <Field label="Fecha de corte">
            <TextInput type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-tech/70">
                <th className="py-2 pr-4 font-500">Paquete</th>
                <th className="py-2 pr-4 text-right font-500">Avance físico %</th>
                <th className="py-2 text-right font-500">Costo real acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {workPackages.map((wp) => (
                <tr key={wp.id}>
                  <td className="py-2 pr-4 text-ink">{wp.nombre}</td>
                  <td className="py-2 pr-4">
                    <NumberInput
                      className="text-right"
                      value={rows[wp.id]!.avance}
                      onChange={(e) => set(wp.id, { avance: e.target.value })}
                      placeholder="0"
                    />
                  </td>
                  <td className="py-2">
                    <NumberInput
                      className="text-right"
                      value={rows[wp.id]!.costo}
                      onChange={(e) => set(wp.id, { costo: e.target.value })}
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[12px] text-tech/70">
          El costo es acumulado (ACWP), no del período. Las filas en blanco no generan corte.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Guardar corte
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function initRows(
  workPackages: WorkPackage[],
  vig: Map<string, ProgressEntry>
): Record<string, Row> {
  const out: Record<string, Row> = {};
  for (const wp of workPackages) {
    const e = vig.get(wp.id);
    out[wp.id] = {
      avance: e ? String(Math.round(e.avanceFisico * 100)) : '',
      costo: e ? String(e.costoRealAcum) : '',
    };
  }
  return out;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
