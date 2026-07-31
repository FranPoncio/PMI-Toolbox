# PMI Toolbox

Aplicación web de gestión de proyectos cuyo diferencial es un **motor completo
de Earned Value Management (EVM)**, configurable por tipo de proyecto (obra
civil, industrial, TI, servicios).

> Estado: en construcción. Incluye el scaffolding, el motor EVM con tests, el
> tablero, y la **persistencia local** (Dexie/IndexedDB) con estado (Zustand):
> crear/editar proyectos y paquetes, cargar cortes de avance y mirar el
> proyecto a cualquier fecha de corte.

## Stack

React + Vite + TypeScript · Zustand · Tailwind · Dexie (IndexedDB) · Vitest.

## Estructura

```
pmi-toolbox/
├─ src/
│  ├─ core/          Lógica pura, sin React (fuente de verdad)
│  │  ├─ types.ts    Modelo de datos + tipos del motor EVM
│  │  ├─ evm.ts      Motor EVM (funciones puras)
│  │  └─ evm.test.ts Tests del motor
│  ├─ analytics/     Análisis derivado (estado, exposición, decisiones,
│  │                 corte vigente e historia EV/AC)
│  ├─ db/            Persistencia con Dexie (IndexedDB) + seed
│  ├─ store/         Estado con Zustand + selectores derivados
│  ├─ fixtures/      Datos de ejemplo (seed inicial)
│  ├─ ui/            Interfaz (tablero, componentes y formularios)
│  └─ test/setup.ts  Setup de testing-library
├─ tailwind.config.ts  Tokens de paleta y tipografías
└─ vite.config.ts      Vite + Vitest
```

## Motor EVM (`src/core/evm.ts`)

Funciones puras que calculan, a una fecha de corte:

| Indicador | Fórmula | Nota |
|-----------|---------|------|
| SV | EV − PV | variación de plazo |
| CV | EV − AC | variación de costo |
| SPI | EV / PV | `null` si PV = 0 |
| CPI | EV / AC | `null` si AC = 0 |
| EAC (`cpi`) | BAC / CPI | desvío sistémico |
| EAC (`budgetRate`) | AC + (BAC − EV) | desvío puntual |
| EAC (`cpiSpi`) | AC + (BAC − EV) / (CPI × SPI) | costo + plazo |
| ETC | EAC − AC | por variante |
| VAC | BAC − EAC | por variante |
| TCPI (BAC) | (BAC − EV) / (BAC − AC) | `null` si BAC = AC |
| TCPI (EAC) | (BAC − EV) / (EAC − AC) | `null` si EAC = null o EAC = AC |

**División por cero:** los indicadores indefinidos devuelven `null` (nunca
`Infinity` ni `NaN`). `null` significa "sin información suficiente todavía".

Las tres curvas (PV, EV, AC) se derivan del modelo de datos con
`plannedValue`, `earnedValue` y `actualCost`; `computeEvm()` agrega todo. El
time-phasing del PV usa una **curva S** (smoothstep de Hermite, `3t²−2t³`) por
defecto — arranque lento, aceleración y desaceleración —, intercambiable por
`linearCurve` u otra `ProgressCurve`.

## Maqueta del tablero (`src/ui`)

Un tablero de ejemplo (proyecto de gasoducto) que materializa las reglas de
diseño:

- Cada pantalla **abre con una conclusión escrita**, no con gráficos.
- **Ningún número absoluto sin su comparación** contra plan (SPI/CPI vs 1.00,
  avance vs plan, EAC vs BAC, etc.).
- **Sin donuts ni gauges**: sólo texto, tablas y una curva S de líneas.
- El panel **"Requiere decisión"** va arriba, ordenado por **exposición**
  económica, con el **motivo explícito** de cada ítem.
- Tema claro, sobrio y de alta densidad (aire de planilla de control):
  Inter para interfaz e IBM Plex Mono para cifras (self-hosted); acentos con
  semántica fija (ámbar = atención, rojo = desvío, verde = dentro de plan).

Correr `npm run dev` y abrir el tablero.

## Comandos

```bash
npm install
npm test         # corre la suite de Vitest
npm run dev      # servidor de desarrollo
npm run build    # build de producción
npm run typecheck
```
