import { useMemo, useState } from 'react';
import type { ProjectType } from '../../core/types';
import { assistant, assistantIsLive, type ProjectDraft } from '../../assistant';
import { usePmStore } from '../../store/pmStore';
import { Modal } from '../components/Modal';
import { Button, Field, NumberInput, Select, TextInput } from '../components/fields';
import { money } from '../format';

const TIPO_LABEL: Record<ProjectType, string> = {
  obra_civil: 'Obra civil',
  industrial: 'Industrial',
  ti: 'TI',
  servicios: 'Servicios',
};

type Phase = 'brief' | 'loading' | 'review' | 'error';

/**
 * Asistente de IA: describís un proyecto de cualquier tipo y la herramienta
 * arma un borrador estructurado (WBS, presupuesto, cronograma, definición de
 * avance) listo para el motor EVM. La IA propone; vos revisás y creás.
 */
export function AssistantModal({ onClose }: { onClose: () => void }) {
  const createFromDraft = usePmStore((s) => s.createProjectFromDraft);

  const [phase, setPhase] = useState<Phase>('brief');
  const [error, setError] = useState('');

  // Brief (entrada del usuario).
  const [descripcion, setDescripcion] = useState('');
  const [moneda, setMoneda] = useState('USD');
  const [presupuesto, setPresupuesto] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');

  // Borrador devuelto por el asistente + campos de cabecera editables.
  const [draft, setDraft] = useState<ProjectDraft | null>(null);

  async function analizar(e: React.FormEvent) {
    e.preventDefault();
    if (descripcion.trim().length < 8) return;
    setPhase('loading');
    setError('');
    try {
      const d = await assistant.analyzeBrief({
        descripcion: descripcion.trim(),
        moneda: moneda || undefined,
        presupuestoTotal: presupuesto ? Number(presupuesto) : undefined,
        fechaInicio: inicio || undefined,
        fechaFin: fin || undefined,
      });
      setDraft(d);
      setPhase('review');
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  }

  async function crear() {
    if (!draft) return;
    await createFromDraft(draft);
    onClose();
  }

  function patch(p: Partial<ProjectDraft>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  const hojas = useMemo(
    () => (draft ? draft.paquetes.filter((p) => p.parentNombre !== null) : []),
    [draft]
  );

  return (
    <Modal title="Armar un proyecto con IA" onClose={onClose} wide>
      {/* ── Paso 1: describir el proyecto ─────────────────────────────────── */}
      {phase === 'brief' && (
        <form onSubmit={analizar}>
          <p className="text-[14px] leading-relaxed text-muted">
            Describí el proyecto que querés medir —de cualquier tipo: obra, producto, venta,
            promoción, estudio— y la herramienta arma la estructura para analizarlo con EVM.
          </p>

          <div className="mt-4">
            <Field label="¿Qué proyecto querés medir?">
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                autoFocus
                placeholder="Ej.: Construcción de 20 viviendas sociales en 14 meses, con un presupuesto de US$ 3.000.000. / Campaña de captación de 500 leads B2B en un trimestre."
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="Moneda" hint="opcional">
              <TextInput value={moneda} onChange={(e) => setMoneda(e.target.value)} placeholder="USD" />
            </Field>
            <Field label="Presupuesto total" hint="opcional">
              <NumberInput value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} placeholder="3000000" />
            </Field>
            <Field label="Inicio" hint="opcional">
              <TextInput type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Field>
            <Field label="Fin" hint="opcional">
              <TextInput type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
            </Field>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-[12px] text-tech/80">
              {assistantIsLive
                ? 'Usando IA (Claude) para armar el plan.'
                : 'Modo demo: el plan se arma con plantillas (sin IA). Conectá el backend para usar Claude.'}
            </span>
            <div className="flex gap-2">
              <Button onClick={onClose}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={descripcion.trim().length < 8}>
                Armar plan →
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* ── Cargando ──────────────────────────────────────────────────────── */}
      {phase === 'loading' && (
        <div className="py-10 text-center">
          <div className="text-[15px] font-600 text-ink">Armando el plan…</div>
          <p className="mt-1 text-[13px] text-muted">
            {assistantIsLive ? 'La IA está estructurando tu proyecto.' : 'Generando la estructura.'}
          </p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <div className="py-6">
          <div className="rounded-md border border-deviation/50 bg-deviation/10 px-4 py-3 text-[13px] text-ink">
            <div className="font-600 text-deviation">No se pudo armar el plan</div>
            <p className="mt-1 text-muted">{error}</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={onClose}>Cerrar</Button>
            <Button variant="primary" onClick={() => setPhase('brief')}>
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {/* ── Paso 2: revisar el borrador ───────────────────────────────────── */}
      {phase === 'review' && draft && (
        <div>
          <div className="rounded-md border border-line bg-bg/60 px-4 py-3">
            <div className="mb-1 text-[11px] font-600 uppercase tracking-[0.12em] text-tech">
              Cómo se mide el avance en este proyecto
            </div>
            <p className="text-[13.5px] text-ink">{draft.definicionAvance}</p>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-muted">{draft.resumen}</p>

          {/* Cabecera editable. */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre del proyecto">
              <TextInput value={draft.nombre} onChange={(e) => patch({ nombre: e.target.value })} />
            </Field>
            <Field label="Tipo">
              <Select value={draft.tipo} onChange={(e) => patch({ tipo: e.target.value as ProjectType })}>
                {(Object.keys(TIPO_LABEL) as ProjectType[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Presupuesto total (BAC)">
              <NumberInput value={draft.bac} onChange={(e) => patch({ bac: Number(e.target.value) })} />
            </Field>
            <Field label="Moneda">
              <TextInput value={draft.moneda} onChange={(e) => patch({ moneda: e.target.value })} />
            </Field>
            <Field label="Inicio">
              <TextInput type="date" value={draft.fechaInicio} onChange={(e) => patch({ fechaInicio: e.target.value })} />
            </Field>
            <Field label="Fin planificado">
              <TextInput type="date" value={draft.fechaFinPlan} onChange={(e) => patch({ fechaFinPlan: e.target.value })} />
            </Field>
          </div>

          {/* WBS propuesta. */}
          <div className="mt-4">
            <div className="mb-1 text-[11px] font-600 uppercase tracking-wider text-tech">
              Estructura de trabajo propuesta ({hojas.length} paquetes)
            </div>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[520px] text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-bg/50 text-left text-[11px] uppercase tracking-wider text-tech">
                    <th className="py-2 pl-3 pr-4 font-500">Paquete</th>
                    <th className="py-2 pr-4 text-right font-500">Presupuesto</th>
                    <th className="py-2 pr-3 font-500">Fechas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {draft.paquetes.map((p, i) => {
                    const esResumen = p.parentNombre === null;
                    return (
                      <tr key={`${p.nombre}-${i}`} className={esResumen ? 'bg-bg/30' : ''}>
                        <td className={`py-1.5 pr-4 ${esResumen ? 'pl-3 font-600 text-ink' : 'pl-7 text-muted'}`}>
                          {p.nombre}
                        </td>
                        <td className="num py-1.5 pr-4 text-right text-ink">
                          {esResumen ? '—' : money(p.presupuesto, draft.moneda)}
                        </td>
                        <td className="num py-1.5 pr-3 text-tech/80">
                          {p.fechaInicioPlan} → {p.fechaFinPlan}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[12px] text-tech/70">
              Podés afinar presupuestos, fechas y responsables después, desde «Datos».
            </p>
          </div>

          {/* Riesgos / KPIs / preguntas. */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {draft.kpis.length > 0 && (
              <div className="rounded-md border border-line px-3 py-2">
                <div className="mb-1 text-[11px] font-600 uppercase tracking-wider text-tech">KPIs sugeridos</div>
                <ul className="list-inside list-disc text-[13px] text-muted">
                  {draft.kpis.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </div>
            )}
            {draft.preguntasAbiertas.length > 0 && (
              <div className="rounded-md border border-amber/40 bg-amber/5 px-3 py-2">
                <div className="mb-1 text-[11px] font-600 uppercase tracking-wider text-amber">Para completar</div>
                <ul className="list-inside list-disc text-[13px] text-muted">
                  {draft.preguntasAbiertas.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button onClick={() => setPhase('brief')}>← Volver a describir</Button>
            <Button variant="primary" onClick={crear}>
              Crear proyecto
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
