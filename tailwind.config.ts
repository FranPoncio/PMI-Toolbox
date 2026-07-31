import type { Config } from 'tailwindcss';

/**
 * Tokens de diseño de PMTool — tema claro, sobrio y de alta densidad, con
 * aire de planilla de control. Fondo claro, paneles blancos, líneas nítidas y
 * acentos con semántica fija (ámbar = atención, desvío = fuera de plan,
 * dentro-de-plan = ok). Nada decorativo.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#ECF0F3', // fondo de aplicación (gris frío claro)
        panel: '#FFFFFF', // paneles / tarjetas
        line: '#D2DAE0', // líneas, bordes, divisores
        ink: '#10222A', // texto principal (casi negro petróleo)
        muted: '#58696F', // texto secundario / apagado
        tech: '#5C6F76', // gris pizarra apagado (etiquetas, subtexto)
        accent: '#206B7E', // acento técnico fuerte (acciones, links, foco)
        amber: '#B07314', // atención / requiere decisión
        deviation: '#BC4327', // desvío (fuera de plan)
        onplan: '#27795A', // dentro de plan
      },
      fontFamily: {
        // Inter para interfaz, IBM Plex Mono para cifras.
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        // Esquinas más marcadas: menos "delicado", más instrumento de cálculo.
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
      },
    },
  },
  plugins: [],
} satisfies Config;
