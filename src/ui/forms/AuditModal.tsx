import type { AuditEntry } from '../../core/types';
import { formatDateTime } from '../format';
import { ACTION_LABEL, ROL_LABEL } from '../labels';
import { Modal } from '../components/Modal';
import { Button } from '../components/fields';

const ACTION_COLOR: Record<string, string> = {
  crear: 'text-onplan border-onplan/40 bg-onplan/10',
  editar: 'text-tech border-line bg-bg',
  borrar: 'text-deviation border-deviation/40 bg-deviation/10',
  congelar: 'text-accent border-accent/40 bg-accent/10',
  importar: 'text-amber border-amber/40 bg-amber/10',
};

/**
 * Bitácora de auditoría del proyecto: quién hizo qué y cuándo. Inmutable —
 * cada cambio deja rastro, para trazabilidad de reporte.
 */
export function AuditModal({
  entries,
  projectNombre,
  onClose,
}: {
  entries: AuditEntry[];
  projectNombre: string;
  onClose: () => void;
}) {
  return (
    <Modal title={`Actividad · ${projectNombre}`} onClose={onClose} wide>
      <p className="mb-3 text-[13px] text-muted">
        Registro inmutable de cambios ({entries.length}). Horas en UTC.
      </p>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Todavía no hay actividad registrada.</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-md border border-line">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead className="sticky top-0 bg-bg/90">
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-tech">
                <th className="px-4 py-2 font-500">Fecha-hora</th>
                <th className="px-4 py-2 font-500">Usuario</th>
                <th className="px-4 py-2 font-500">Acción</th>
                <th className="px-4 py-2 font-500">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="num whitespace-nowrap px-4 py-2 text-muted">{formatDateTime(e.ts)}</td>
                  <td className="px-4 py-2">
                    <div className="font-500 text-ink">{e.userNombre}</div>
                    <div className="text-[11px] text-tech">{ROL_LABEL[e.userRol]}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-500 ${
                        ACTION_COLOR[e.action] ?? 'text-tech border-line'
                      }`}
                    >
                      {ACTION_LABEL[e.action]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink">{e.resumen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  );
}
