import type { Status } from '../analytics/status';

export interface StatusStyle {
  /** Etiqueta legible del estado. */
  label: string;
  /** Color de acento (hex de la paleta). */
  color: string;
  /** Clases Tailwind para texto de acento. */
  text: string;
  /** Clases Tailwind para borde de acento. */
  border: string;
  /** Clases Tailwind para fondo tenue de acento. */
  bg: string;
}

export const STATUS_STYLE: Record<Status, StatusStyle> = {
  onplan: {
    label: 'Dentro de plan',
    color: '#27795A',
    text: 'text-onplan',
    border: 'border-onplan/50',
    bg: 'bg-onplan/10',
  },
  atencion: {
    label: 'Atención',
    color: '#B07314',
    text: 'text-amber',
    border: 'border-amber/50',
    bg: 'bg-amber/10',
  },
  desvio: {
    label: 'Desvío',
    color: '#BC4327',
    text: 'text-deviation',
    border: 'border-deviation/50',
    bg: 'bg-deviation/10',
  },
  'sin-dato': {
    label: 'Sin datos aún',
    color: '#58696F',
    text: 'text-muted',
    border: 'border-line',
    bg: 'bg-bg',
  },
};
