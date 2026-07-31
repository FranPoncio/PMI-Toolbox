import { useState } from 'react';
import type { Project, WorkPackage } from '../../core/types';
import { usePmStore } from '../../store/pmStore';
import { Modal } from '../components/Modal';
import { Button } from '../components/fields';
import { money } from '../format';
import { ProjectForm } from './ProjectForm';
import { WorkPackageForm } from './WorkPackageForm';

type View = { kind: 'list' } | { kind: 'project' } | { kind: 'wp'; wp?: WorkPackage };

/** Editor de datos del proyecto: sus paquetes de trabajo y sus atributos. */
export function DataModal({
  project,
  workPackages,
  onClose,
}: {
  project: Project;
  workPackages: WorkPackage[];
  onClose: () => void;
}) {
  const removeWorkPackage = usePmStore((s) => s.removeWorkPackage);
  const [view, setView] = useState<View>({ kind: 'list' });

  const totalWp = workPackages.reduce((a, w) => a + w.presupuesto, 0);

  if (view.kind === 'project') {
    return (
      <Modal title="Editar proyecto" onClose={onClose}>
        <ProjectForm project={project} onDone={onClose} />
      </Modal>
    );
  }
  if (view.kind === 'wp') {
    return (
      <Modal title={view.wp ? 'Editar paquete' : 'Nuevo paquete'} onClose={() => setView({ kind: 'list' })}>
        <WorkPackageForm projectId={project.id} wp={view.wp} onDone={() => setView({ kind: 'list' })} />
      </Modal>
    );
  }

  return (
    <Modal title={`Datos · ${project.nombre}`} onClose={onClose} wide>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[13px] text-tech">
          {workPackages.length} paquete(s) · suma {money(totalWp, project.moneda)} de{' '}
          {money(project.bac, project.moneda)} (BAC)
          {totalWp !== project.bac && (
            <span className="ml-2 text-amber">· no coincide con el BAC</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setView({ kind: 'project' })}>Editar proyecto</Button>
          <Button variant="primary" onClick={() => setView({ kind: 'wp' })}>
            ＋ Paquete
          </Button>
        </div>
      </div>

      {workPackages.length === 0 ? (
        <p className="py-6 text-center text-sm text-tech">Todavía no hay paquetes de trabajo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-tech/70">
                <th className="py-2 pr-4 font-500">Paquete</th>
                <th className="py-2 pr-4 text-right font-500">Presupuesto</th>
                <th className="py-2 pr-4 font-500">Plan</th>
                <th className="py-2 font-500" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {workPackages.map((wp) => (
                <tr key={wp.id}>
                  <td className="py-2 pr-4">
                    <div className="font-500 text-ink">{wp.nombre}</div>
                    <div className="text-[12px] text-tech/80">{wp.responsable || '—'}</div>
                  </td>
                  <td className="num py-2 pr-4 text-right text-ink">
                    {money(wp.presupuesto, project.moneda)}
                  </td>
                  <td className="num py-2 pr-4 text-[12px] text-tech">
                    {wp.fechaInicioPlan} → {wp.fechaFinPlan}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => setView({ kind: 'wp', wp })}>Editar</Button>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          if (confirm(`¿Borrar «${wp.nombre}» y sus cortes?`)) await removeWorkPackage(wp.id);
                        }}
                      >
                        Borrar
                      </Button>
                    </div>
                  </td>
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
