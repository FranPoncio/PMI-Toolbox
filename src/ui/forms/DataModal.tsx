import { useState } from 'react';
import type { Project, WorkPackage } from '../../core/types';
import { childrenOf, isLeaf, leaves, roots } from '../../analytics/wbs';
import { usePmStore } from '../../store/pmStore';
import { Modal } from '../components/Modal';
import { Button } from '../components/fields';
import { money } from '../format';
import { ImportModal } from './ImportModal';
import { ProjectForm } from './ProjectForm';
import { WorkPackageForm } from './WorkPackageForm';

/** Aplana la WBS en orden (padre antes que hijos) con su profundidad. */
function ordenarWbs(all: WorkPackage[]): Array<{ wp: WorkPackage; depth: number }> {
  const out: Array<{ wp: WorkPackage; depth: number }> = [];
  const visit = (wp: WorkPackage, depth: number) => {
    out.push({ wp, depth });
    for (const c of childrenOf(wp.id, all)) visit(c, depth + 1);
  };
  for (const r of roots(all)) visit(r, 0);
  return out;
}

type View =
  | { kind: 'list' }
  | { kind: 'project' }
  | { kind: 'wp'; wp?: WorkPackage }
  | { kind: 'import' };

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

  // El BAC vive en las hojas; los nodos de resumen no suman (evita doble conteo).
  const totalWp = leaves(workPackages).reduce((a, w) => a + w.presupuesto, 0);
  const filas = ordenarWbs(workPackages);

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
        <WorkPackageForm
          projectId={project.id}
          workPackages={workPackages}
          wp={view.wp}
          onDone={() => setView({ kind: 'list' })}
        />
      </Modal>
    );
  }
  if (view.kind === 'import') {
    return <ImportModal project={project} onClose={() => setView({ kind: 'list' })} />;
  }

  return (
    <Modal title={`Datos · ${project.nombre}`} onClose={onClose} wide>
      <div className="mb-3 rounded-md border border-line bg-bg/60 px-4 py-2.5 text-[13px] text-muted">
        La estructura de trabajo (WBS). Cargá el dato en las <span className="text-ink">hojas</span>; los
        <span className="text-ink"> resúmenes</span> (con sub-paquetes) se calculan solos. Anidá con el campo
        «Depende de». Importá un cronograma completo con <span className="text-ink">Importar CSV</span>.
      </div>
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
          <Button onClick={() => setView({ kind: 'import' })}>Importar CSV</Button>
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
              {filas.map(({ wp, depth }) => {
                const resumen = !isLeaf(wp, workPackages);
                return (
                  <tr key={wp.id} className={resumen ? 'bg-bg/40' : ''}>
                    <td className="py-2 pr-4">
                      <div style={{ paddingLeft: `${depth * 16}px` }}>
                        <div className={resumen ? 'font-700 text-ink' : 'font-500 text-ink'}>
                          {resumen && <span className="mr-1 text-tech/60">▾</span>}
                          {wp.nombre}
                        </div>
                        {!resumen && (
                          <div className="text-[12px] text-tech/80">{wp.responsable || '—'}</div>
                        )}
                      </div>
                    </td>
                    <td className="num py-2 pr-4 text-right text-ink">
                      {resumen ? <span className="text-tech/60">roll-up</span> : money(wp.presupuesto, project.moneda)}
                    </td>
                    <td className="num py-2 pr-4 text-[12px] text-tech">
                      {resumen ? '—' : `${wp.fechaInicioPlan} → ${wp.fechaFinPlan}`}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => setView({ kind: 'wp', wp })}>Editar</Button>
                        <Button
                          variant="danger"
                          onClick={async () => {
                            const msg = resumen
                              ? `¿Borrar «${wp.nombre}» y todos sus sub-paquetes y cortes?`
                              : `¿Borrar «${wp.nombre}» y sus cortes?`;
                            if (confirm(msg)) await removeWorkPackage(wp.id);
                          }}
                        >
                          Borrar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
