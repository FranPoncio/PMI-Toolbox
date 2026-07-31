import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from './fields';

export interface TourStep {
  /** Selector CSS del elemento a resaltar. Si falta, el paso va centrado. */
  selector?: string;
  title: string;
  body: string;
  /** Diálogo/menú que este paso abre (lo interpreta el contenedor). */
  dialog?: string;
}

const PAD = 6;
const TIP_W = 340;

/**
 * Recorrido guiado con "spotlight": oscurece la pantalla y resalta cada
 * elemento en secuencia, con un globo de ayuda. Sin dependencias.
 *
 * `onStepChange` avisa qué paso está activo para que el contenedor pueda abrir
 * el menú correspondiente (así el foco cae sobre el modal recién abierto).
 */
export function Tour({
  steps,
  onFinish,
  onStepChange,
}: {
  steps: TourStep[];
  onFinish: () => void;
  onStepChange?: (step: TourStep) => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const step = steps[i]!;
  const last = i === steps.length - 1;

  // Avisa el cambio de paso (para abrir/cerrar el menú del paso).
  useEffect(() => {
    onStepChange?.(steps[i]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // Ubica y mide el elemento del paso. Reintenta unas veces porque el objetivo
  // puede montar tarde (p. ej. un modal que se acaba de abrir).
  useLayoutEffect(() => {
    const sel = steps[i]!.selector;
    const find = () => (sel ? (document.querySelector(sel) as HTMLElement | null) : null);
    let scrolled = false;
    const measure = () => {
      const e = find();
      if (e && !scrolled) {
        e.scrollIntoView({ block: 'center', behavior: 'smooth' });
        scrolled = true;
      }
      setRect(e ? e.getBoundingClientRect() : null);
    };
    measure();
    const timers = [60, 180, 320, 500].map((d) => window.setTimeout(measure, d));
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [i, steps]);

  // Posiciona el globo respecto del elemento (o centrado si no hay).
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const th = el.offsetHeight;
    const tw = el.offsetWidth;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) {
      setTip({ top: vh / 2 - th / 2, left: vw / 2 - tw / 2 });
      return;
    }
    let top = rect.bottom + 12;
    if (top + th > vh - 12) top = Math.max(12, rect.top - th - 12);
    const left = Math.min(Math.max(12, rect.left), vw - tw - 12);
    setTip({ top, left });
  }, [rect, i]);

  // Teclado: Esc salta, flechas navegan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
      else if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, steps.length - 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFinish, steps.length]);

  return (
    <>
      {/* Capturador de clics (transparente): la app no se opera durante el tour. */}
      <div className="fixed inset-0 z-[55]" onClick={onFinish} />

      {/* Spotlight: un recorte claro con el resto oscurecido por el box-shadow. */}
      {rect && (
        <div
          className="pointer-events-none fixed z-[60] rounded-md"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(11, 25, 32, 0.55)',
            border: '2px solid #206b7e',
            transition: 'all 180ms ease',
          }}
        />
      )}

      {/* Globo de ayuda. */}
      <div
        ref={tipRef}
        className="fixed z-[70] rounded-md border border-line bg-panel shadow-xl"
        style={{ top: tip.top, left: tip.left, width: TIP_W, maxWidth: 'calc(100vw - 24px)' }}
      >
        <div className="px-4 py-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="num text-[11px] font-600 uppercase tracking-[0.12em] text-tech">
              Recorrido · {i + 1} de {steps.length}
            </span>
            <button
              onClick={onFinish}
              className="text-[12px] text-muted hover:text-ink"
              aria-label="Saltar el recorrido"
            >
              Saltar
            </button>
          </div>
          <h3 className="text-[15px] font-600 text-ink">{step.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{step.body}</p>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setI((n) => Math.max(n - 1, 0))}
              disabled={i === 0}
              className="text-[13px] text-tech hover:text-ink disabled:opacity-30"
            >
              ← Anterior
            </button>
            <Button
              variant="primary"
              onClick={() => (last ? onFinish() : setI((n) => n + 1))}
            >
              {last ? 'Listo' : 'Siguiente →'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
