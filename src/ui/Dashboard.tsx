import { useEffect, useState } from 'react';
import { usePmStore } from '../store/pmStore';
import { useProjectView } from '../store/selectors';
import { buildConclusion } from './conclusion';
import { DecisionPanel } from './components/DecisionPanel';
import { EvmSummary } from './components/EvmSummary';
import { SCurveChart } from './components/SCurveChart';
import { WorkPackageTable } from './components/WorkPackageTable';
import { StatusPill } from './components/primitives';
import { Button, Select } from './components/fields';
import { Modal } from './components/Modal';
import { DataModal } from './forms/DataModal';
import { ProgressForm } from './forms/ProgressForm';
import { ProjectForm } from './forms/ProjectForm';

const TIPO_LABEL: Record<string, string> = {
  obra_civil: 'Obra civil',
  industrial: 'Industrial',
  ti: 'TI',
  servicios: 'Servicios',
};

type Dialog = 'progress' | 'data' | 'newProject' | null;

export function Dashboard() {
  const init = usePmStore((s) => s.init);
  const status = usePmStore((s) => s.status);
  const projects = usePmStore((s) => s.projects);
  const selectedProjectId = usePmStore((s) => s.selectedProjectId);
  const selectProject = usePmStore((s) => s.selectProject);
  const setDataDate = usePmStore((s) => s.setDataDate);
  const workPackages = usePmStore((s) => s.workPackages);
  const progressEntries = usePmStore((s) => s.progressEntries);

  const view = useProjectView();
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    void init();
  }, [init]);

  if (status !== 'ready') {
    return <div className="p-10 text-sm text-tech">Cargando…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Toolbar: proyecto, corte y acciones. */}
      <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <div className="text-[11px] font-600 uppercase tracking-[0.16em] text-tech">
          PMTool · Tablero EVM
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {projects.length > 0 && (
            <Select
              value={selectedProjectId ?? ''}
              onChange={(e) => void selectProject(e.target.value)}
              className="max-w-[280px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          )}
          {view && view.availableCuts.length > 0 && (
            <Select value={view.dataDate} onChange={(e) => setDataDate(e.target.value)}>
              {view.availableCuts.map((d) => (
                <option key={d} value={d}>
                  Corte {d}
                </option>
              ))}
            </Select>
          )}
          {view && <Button onClick={() => setDialog('progress')}>＋ Corte</Button>}
          {view && <Button onClick={() => setDialog('data')}>Datos</Button>}
          <Button variant="primary" onClick={() => setDialog('newProject')}>
            Nuevo proyecto
          </Button>
        </div>
      </div>

      {!view ? (
        <EmptyState hasProject={!!selectedProjectId} onNew={() => setDialog('newProject')} />
      ) : (
        <ProjectDashboard view={view} onLoadCut={() => setDialog('progress')} />
      )}

      {/* Modales. */}
      {dialog === 'newProject' && (
        <Modal title="Nuevo proyecto" onClose={() => setDialog(null)}>
          <ProjectForm onDone={() => setDialog(null)} />
        </Modal>
      )}
      {dialog === 'data' && view && (
        <DataModal project={view.project} workPackages={workPackages} onClose={() => setDialog(null)} />
      )}
      {dialog === 'progress' && view && (
        <ProgressForm
          project={view.project}
          workPackages={workPackages}
          progressEntries={progressEntries}
          defaultDate={view.dataDate}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function ProjectDashboard({
  view,
  onLoadCut,
}: {
  view: NonNullable<ReturnType<typeof useProjectView>>;
  onLoadCut: () => void;
}) {
  const { project, analysis, history, dataDate } = view;
  const workPackages = usePmStore((s) => s.workPackages);
  const conclusion = buildConclusion(analysis);
  const cur = project.moneda;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-700 leading-tight text-ink">{project.nombre}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-tech">
            <span>{TIPO_LABEL[project.tipo]}</span>
            <span className="text-tech/40">·</span>
            <span className="num">{project.moneda}</span>
            <span className="text-tech/40">·</span>
            <span>
              Fecha de corte: <span className="num">{dataDate}</span>
            </span>
          </div>
        </div>
        <StatusPill status={analysis.status} />
      </header>

      {/* Regla de diseño: la pantalla abre con una conclusión escrita. */}
      <section className="mt-6 max-w-3xl">
        <h2 className="text-lg font-600 leading-snug text-ink">{conclusion.titular}</h2>
        {conclusion.parrafos.map((p, i) => (
          <p key={i} className="mt-2 text-[14px] leading-relaxed text-muted">
            {p}
          </p>
        ))}
      </section>

      {workPackages.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-panel px-5 py-8 text-center">
          <p className="text-sm text-tech">
            Este proyecto todavía no tiene paquetes de trabajo ni cortes de avance.
          </p>
          <p className="mt-1 text-[13px] text-tech/70">
            Cargá paquetes desde «Datos» y después registrá cortes con «＋ Corte».
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <DecisionPanel items={analysis.decisiones} currency={cur} />
          <EvmSummary evm={analysis.evm} currency={cur} />
          <SCurveChart
            project={project}
            workPackages={workPackages}
            dataDate={dataDate}
            history={history}
          />
          <WorkPackageTable packages={analysis.packages} currency={cur} />
        </div>
      )}

      <footer className="mt-8 border-t border-line pt-4 text-[12px] text-tech/70">
        Datos persistidos localmente (IndexedDB). El motor de cálculo vive en{' '}
        <span className="num">src/core/evm.ts</span> y está cubierto por tests.{' '}
        <button className="text-accent underline hover:text-ink" onClick={onLoadCut}>
          Cargar un corte
        </button>
        .
      </footer>
    </>
  );
}

function EmptyState({ hasProject, onNew }: { hasProject: boolean; onNew: () => void }) {
  return (
    <div className="mt-10 rounded-lg border border-dashed border-line bg-panel px-6 py-12 text-center">
      <h2 className="text-lg font-600 text-ink">
        {hasProject ? 'Proyecto sin fecha de corte' : 'No hay proyectos todavía'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-tech">
        {hasProject
          ? 'Cargá un corte de avance para empezar a ver los indicadores EVM.'
          : 'Creá tu primer proyecto para empezar a medir avance físico y costo contra plan.'}
      </p>
      <div className="mt-5">
        <Button variant="primary" onClick={onNew}>
          Nuevo proyecto
        </Button>
      </div>
    </div>
  );
}
