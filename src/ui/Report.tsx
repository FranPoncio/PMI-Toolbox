import type { ProjectView } from '../store/selectors';
import { buildConclusion } from './conclusion';
import { DecisionPanel } from './components/DecisionPanel';
import { EvmSummary } from './components/EvmSummary';
import { SCurveChart } from './components/SCurveChart';
import { SchedulePanel } from './components/SchedulePanel';
import { WorkPackageTable } from './components/WorkPackageTable';
import { Button } from './components/fields';

const TIPO_LABEL: Record<string, string> = {
  obra_civil: 'Obra civil',
  industrial: 'Industrial',
  ti: 'TI',
  servicios: 'Servicios',
};

/**
 * Vista de reporte imprimible. Es un documento (no un tablero interactivo):
 * se abre en pantalla completa y con "Imprimir / Guardar PDF" el navegador lo
 * exporta a PDF. El CSS de impresión (index.css) oculta el resto de la app.
 */
export function Report({ view, onClose }: { view: ProjectView; onClose: () => void }) {
  const { project, analysis, history, planItems, bac, baseline, dataDate } = view;
  const conclusion = buildConclusion(analysis);
  const generado = new Date().toISOString().slice(0, 10);

  return (
    <div className="report-overlay fixed inset-0 z-50 overflow-auto bg-white">
      {/* Barra de acciones (no se imprime). */}
      <div className="no-print sticky top-0 flex justify-end gap-2 border-b border-line bg-bg px-6 py-3">
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="primary" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </Button>
      </div>

      <div className="report-doc mx-auto max-w-4xl px-8 py-8">
        {/* Encabezado del documento. */}
        <div className="mb-6 border-b border-line pb-4">
          <div className="text-[11px] font-600 uppercase tracking-[0.16em] text-tech">
            PMI Toolbox · Reporte de desempeño (EVM)
          </div>
          <h1 className="mt-1 text-[24px] font-700 leading-tight text-ink">{project.nombre}</h1>
          <div className="num mt-1.5 text-[13px] text-muted">
            {TIPO_LABEL[project.tipo]} · {project.moneda} · Fecha de corte {dataDate} ·{' '}
            {baseline ? `Línea base v${baseline.version} (${baseline.fechaAprobacion})` : 'sin línea base'}{' '}
            · Generado {generado}
          </div>
        </div>

        {/* Conclusión ejecutiva. */}
        <section className="avoid-break mb-6">
          <h2 className="text-lg font-600 leading-snug text-ink">{conclusion.titular}</h2>
          {conclusion.parrafos.map((p, i) => (
            <p key={i} className="mt-2 text-[14px] leading-relaxed text-muted">
              {p}
            </p>
          ))}
        </section>

        <div className="space-y-5">
          <div className="avoid-break">
            <DecisionPanel items={analysis.decisiones} currency={project.moneda} />
          </div>
          <div className="avoid-break">
            <EvmSummary evm={analysis.evm} currency={project.moneda} />
          </div>
          <div className="avoid-break">
            <SchedulePanel forecast={view.forecast} />
          </div>
          <div className="avoid-break">
            <SCurveChart
              project={project}
              planItems={planItems}
              bac={bac}
              dataDate={dataDate}
              history={history}
            />
          </div>
          <div className="avoid-break">
            <WorkPackageTable packages={analysis.packages} currency={project.moneda} />
          </div>

          {(project.riesgos || project.proximosPasos) && (
            <div className="avoid-break grid grid-cols-1 gap-5 sm:grid-cols-2">
              {project.riesgos && (
                <section className="rounded-md border border-line bg-panel">
                  <div className="border-b border-line bg-bg/70 px-5 py-3 text-[11px] font-600 uppercase tracking-[0.14em] text-tech">
                    Riesgos e issues
                  </div>
                  <p className="whitespace-pre-line px-5 py-4 text-[13px] leading-relaxed text-ink">
                    {project.riesgos}
                  </p>
                </section>
              )}
              {project.proximosPasos && (
                <section className="rounded-md border border-line bg-panel">
                  <div className="border-b border-line bg-bg/70 px-5 py-3 text-[11px] font-600 uppercase tracking-[0.14em] text-tech">
                    Próximos pasos
                  </div>
                  <p className="whitespace-pre-line px-5 py-4 text-[13px] leading-relaxed text-ink">
                    {project.proximosPasos}
                  </p>
                </section>
              )}
            </div>
          )}
        </div>

        <p className="mt-8 border-t border-line pt-4 text-[11px] text-muted">
          Reporte generado por PMI Toolbox. Indicadores calculados según Earned Value Management
          {baseline ? ` contra la línea base v${baseline.version}` : ' (sin línea base congelada)'}.
        </p>
      </div>
    </div>
  );
}
