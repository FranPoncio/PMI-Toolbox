import { Modal } from '../components/Modal';
import { Button } from '../components/fields';

/** URL de la guía de uso publicada como página web. */
export const GUIA_URL = 'https://claude.ai/code/artifact/7852d29b-849a-442f-b2cb-f7ab7d9e8200';

const PASOS: Array<{ n: string; t: string; d: string }> = [
  { n: '1', t: 'Creá el proyecto', d: 'Nombre, BAC (presupuesto total), fechas y moneda.' },
  { n: '2', t: 'Cargá la WBS', d: 'Los paquetes de trabajo, uno a uno o importando un CSV. Podés anidarlos.' },
  { n: '3', t: 'Congelá la línea base', d: 'El plan aprobado contra el que se mide todo. Después no se mueve.' },
  { n: '4', t: 'Cargá cortes', d: 'En cada fecha: el % de avance físico y el costo real acumulado.' },
  { n: '5', t: 'Leé el tablero', d: 'Abre con la conclusión escrita y el panel de decisiones.' },
  { n: '6', t: 'Exportá', d: 'CSV para Excel, o el reporte imprimible en PDF para el comité.' },
];

/**
 * Introducción de bienvenida: se muestra en el primer arranque (y se puede
 * reabrir desde «Guía»). Explica el flujo de trabajo de un vistazo.
 */
export function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Bienvenido a PMI Toolbox" onClose={onClose} wide>
      <p className="text-[14px] leading-relaxed text-muted">
        PMI Toolbox mide tus proyectos con <strong className="text-ink">Earned Value Management (EVM)</strong>:
        cargás el plan, reportás avance y costo en cada corte, y la herramienta te dice —en texto y con
        números— <strong className="text-ink">cómo venís contra el plan y dónde tenés que decidir</strong>.
      </p>

      <div className="mt-4 rounded-md border border-line bg-bg/60 px-4 py-3">
        <div className="mb-2 text-[11px] font-600 uppercase tracking-[0.12em] text-tech">
          El flujo en 6 pasos
        </div>
        <ol className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {PASOS.map((p) => (
            <li key={p.n} className="flex gap-3">
              <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-[12px] font-600 text-accent">
                {p.n}
              </span>
              <span>
                <span className="block text-[13.5px] font-600 text-ink">{p.t}</span>
                <span className="block text-[12.5px] leading-snug text-muted">{p.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-muted">
        Ya hay un <strong className="text-ink">proyecto de ejemplo</strong> cargado (un gasoducto) para que
        explores. Cada botón de la barra tiene una ayuda al pasar el mouse, y podés reabrir esta intro con{' '}
        <span className="rounded bg-accent/10 px-1 font-600 text-ink">Guía</span>.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <a
          href={GUIA_URL}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] font-500 text-accent underline hover:text-ink"
        >
          Abrir la guía de uso completa ↗
        </a>
        <Button variant="primary" onClick={onClose}>
          Empezar
        </Button>
      </div>
    </Modal>
  );
}
