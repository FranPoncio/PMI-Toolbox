import { useEffect, useState } from 'react';
import { usePmStore } from '../store/pmStore';
import { useProjectView } from '../store/selectors';
import { buildConclusion } from './conclusion';
import { DecisionPanel } from './components/DecisionPanel';
import { EvmSummary } from './components/EvmSummary';
import { SCurveChart } from './components/SCurveChart';
import { SchedulePanel } from './components/SchedulePanel';
import { WorkPackageTable } from './components/WorkPackageTable';
import { StatusPill } from './components/primitives';
import { Button, Select } from './components/fields';
import { Modal } from './components/Modal';
import { AuditModal } from './forms/AuditModal';
import { BaselineModal } from './forms/BaselineModal';
import { DataModal } from './forms/DataModal';
import { ProgressForm } from './forms/ProgressForm';
import { ProjectForm } from './forms/ProjectForm';
import { Report } from './Report';
import { WelcomeModal } from './forms/WelcomeModal';
import { Tour, type TourStep } from './components/Tour';
import { ROL_LABEL } from './labels';
import { buildCsv, downloadCsv } from './export';

const ONBOARDED_KEY = 'pmi-toolbox.onboarded';

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="session"]',
    title: 'Tu sesión',
    body: 'Elegí quién opera. Cada cambio que hagas queda registrado a tu nombre en la bitácora.',
  },
  {
    selector: '[data-tour="corte"]',
    title: 'Fecha de corte',
    body: 'Mirá el proyecto a cualquier fecha de corte cargada. El tablero se recalcula a esa fecha.',
  },
  {
    selector: '[data-tour="btn-datos"]',
    title: '1 · Datos (la WBS)',
    body: 'Acá cargás y editás los paquetes de trabajo y su jerarquía. También importás un cronograma por CSV.',
  },
  {
    selector: '[data-tour="btn-baseline"]',
    title: '2 · Línea base',
    body: 'Congelás el plan aprobado. A partir de ahí, todo se mide contra esa foto.',
  },
  {
    selector: '[data-tour="btn-corte"]',
    title: '3 · Cargar corte',
    body: 'En cada fecha cargás el % de avance físico y el costo real acumulado de cada paquete.',
  },
  {
    selector: '[data-tour="conclusion"]',
    title: 'La conclusión',
    body: 'El tablero abre con un veredicto en texto: si vas atrasado y/o sobre presupuesto, y por cuánto.',
  },
  {
    selector: '[data-tour="decision"]',
    title: 'Requiere decisión',
    body: 'Los paquetes fuera de plan, ordenados por exposición (la plata en juego), con el motivo de cada uno.',
  },
  {
    selector: '[data-tour="btn-report"]',
    title: '4 · Reporte',
    body: 'Sacás el documento imprimible para el comité (Guardar como PDF). Con «Exportar» bajás el CSV.',
  },
  {
    title: '¡Listo!',
    body: 'Ya conocés el circuito. Podés reabrir esta ayuda y el recorrido con el botón «Guía» cuando quieras.',
  },
];

const TIPO_LABEL: Record<string, string> = {
  obra_civil: 'Obra civil',
  industrial: 'Industrial',
  ti: 'TI',
  servicios: 'Servicios',
};

type Dialog = 'progress' | 'data' | 'baseline' | 'report' | 'audit' | 'newProject' | null;

export function Dashboard() {
  const init = usePmStore((s) => s.init);
  const status = usePmStore((s) => s.status);
  const projects = usePmStore((s) => s.projects);
  const selectedProjectId = usePmStore((s) => s.selectedProjectId);
  const selectProject = usePmStore((s) => s.selectProject);
  const setDataDate = usePmStore((s) => s.setDataDate);
  const workPackages = usePmStore((s) => s.workPackages);
  const progressEntries = usePmStore((s) => s.progressEntries);
  const users = usePmStore((s) => s.users);
  const currentUserId = usePmStore((s) => s.currentUserId);
  const setCurrentUser = usePmStore((s) => s.setCurrentUser);
  const auditLog = usePmStore((s) => s.auditLog);

  const view = useProjectView();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [welcome, setWelcome] = useState(false);
  const [tour, setTour] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  // Intro de bienvenida en el primer arranque.
  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDED_KEY)) setWelcome(true);
    } catch {
      /* sin localStorage: no mostramos la intro automáticamente */
    }
  }, []);

  function closeWelcome() {
    setWelcome(false);
    try {
      localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      /* noop */
    }
  }

  if (status !== 'ready') {
    return <div className="p-10 text-sm text-tech">Cargando…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Toolbar: proyecto, corte y acciones. */}
      <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <div className="text-[11px] font-600 uppercase tracking-[0.16em] text-tech">
          PMI Toolbox · Tablero EVM
        </div>
        {/* Sesión: quién está operando (atribuye la trazabilidad). */}
        {users.length > 0 && (
          <label
            data-tour="session"
            className="flex items-center gap-1.5 text-[12px] text-muted"
            title="Quién está operando; cada cambio queda registrado a su nombre en la bitácora"
          >
            <span className="text-tech">Sesión</span>
            <Select
              value={currentUserId ?? ''}
              onChange={(e) => setCurrentUser(e.target.value)}
              className="py-1"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} · {ROL_LABEL[u.rol]}
                </option>
              ))}
            </Select>
          </label>
        )}
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
            <span data-tour="corte" className="inline-flex">
              <Select value={view.dataDate} onChange={(e) => setDataDate(e.target.value)}>
                {view.availableCuts.map((d) => (
                  <option key={d} value={d}>
                    Corte {d}
                  </option>
                ))}
              </Select>
            </span>
          )}
          {view && (
            <span data-tour="btn-corte" className="inline-flex">
              <Button
                title="Cargar el avance físico y el costo real de una fecha de corte"
                onClick={() => setDialog('progress')}
              >
                ＋ Corte
              </Button>
            </span>
          )}
          {view && (
            <span data-tour="btn-datos" className="inline-flex">
              <Button
                title="Editar el proyecto y su estructura de paquetes (WBS)"
                onClick={() => setDialog('data')}
              >
                Datos
              </Button>
            </span>
          )}
          {view && (
            <span data-tour="btn-baseline" className="inline-flex">
              <Button
                title="Ver o congelar la línea base: el plan aprobado contra el que se mide"
                onClick={() => setDialog('baseline')}
              >
                {view.baseline ? `Línea base v${view.baseline.version}` : 'Línea base'}
              </Button>
            </span>
          )}
          {view && (
            <Button
              title="Descargar el corte actual en CSV (para Excel)"
              onClick={() =>
                downloadCsv(
                  `pmi-toolbox_${view.project.nombre.replace(/\s+/g, '-')}_${view.dataDate}.csv`,
                  buildCsv(view)
                )
              }
            >
              Exportar
            </Button>
          )}
          {view && (
            <span data-tour="btn-report" className="inline-flex">
              <Button title="Abrir el reporte imprimible (Guardar como PDF)" onClick={() => setDialog('report')}>
                Reporte
              </Button>
            </span>
          )}
          {view && (
            <Button title="Bitácora de auditoría: quién hizo qué y cuándo" onClick={() => setDialog('audit')}>
              Actividad
            </Button>
          )}
          <Button title="Ver la introducción y cómo usar la app" onClick={() => setWelcome(true)}>
            Guía
          </Button>
          <Button
            variant="primary"
            title="Crear un proyecto nuevo"
            onClick={() => setDialog('newProject')}
          >
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
      {dialog === 'baseline' && view && (
        <BaselineModal
          project={view.project}
          baseline={view.baseline}
          baselines={view.baselines}
          divergence={view.divergence}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'report' && view && <Report view={view} onClose={() => setDialog(null)} />}
      {dialog === 'audit' && view && (
        <AuditModal
          entries={auditLog}
          projectNombre={view.project.nombre}
          onClose={() => setDialog(null)}
        />
      )}
      {welcome && (
        <WelcomeModal
          onClose={closeWelcome}
          onTour={() => {
            closeWelcome();
            setTour(true);
          }}
        />
      )}
      {tour && <Tour steps={TOUR_STEPS} onFinish={() => setTour(false)} />}
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
  const { project, analysis, history, forecast, planItems, bac, baseline, divergence, dataDate } =
    view;
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
            <span className="text-tech/40">·</span>
            <span>
              {baseline ? (
                <>
                  Línea base <span className="num">v{baseline.version}</span> ({baseline.fechaAprobacion})
                  {divergence.cambio && <span className="text-amber"> · WBS diverge</span>}
                </>
              ) : (
                <span className="text-amber">Sin línea base</span>
              )}
            </span>
          </div>
        </div>
        <StatusPill status={analysis.status} />
      </header>

      {/* Regla de diseño: la pantalla abre con una conclusión escrita. */}
      <section data-tour="conclusion" className="mt-6 max-w-3xl">
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
          <div data-tour="decision">
            <DecisionPanel items={analysis.decisiones} currency={cur} />
          </div>
          <EvmSummary evm={analysis.evm} currency={cur} />
          <SchedulePanel forecast={forecast} />
          <SCurveChart
            project={project}
            planItems={planItems}
            bac={bac}
            dataDate={dataDate}
            history={history}
          />
          <WorkPackageTable tree={analysis.tree} currency={cur} />
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
