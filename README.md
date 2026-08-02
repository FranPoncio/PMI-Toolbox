# 📊 PMI Toolbox

Aplicación web de **gestión de proyectos con un motor completo de Earned Value
Management (EVM)**, configurable por tipo de proyecto (obra civil, industrial,
TI, servicios). Pensada para el analista de control de proyectos / PMO que
reporta avance físico y costo contra una línea base — el idioma de la obra de
infraestructura y del reporte a organismos multilaterales de crédito.

> **Estado:** en construcción activa. Ya funciona de punta a punta: motor de
> cálculo testeado, tablero, persistencia local, pronóstico de plazo (Earned
> Schedule) y export a CSV. Ver [Roadmap](#-roadmap).

> 📖 **¿Cómo se usa?** Guía de uso: en **[página web](https://claude.ai/code/artifact/7852d29b-849a-442f-b2cb-f7ab7d9e8200)**
> o en **[Markdown](docs/GUIA-DE-USO.md)** — el manual paso a paso (crear proyecto
> → WBS → línea base → cortes → reporte). La app también abre con una **intro
> de bienvenida**, un **recorrido guiado** (spotlight paso a paso) y ayudas en
> cada menú.
>
> 🎬 **Videos y capturas:** ver **[docs/media](docs/media/)** — demo completa,
> demo de carga de un corte, y capturas del tablero, el reporte y el onboarding.

---

## ✨ Qué hace

1. **Motor EVM completo.** Calcula, a cualquier fecha de corte: PV, EV, AC, SV,
   CV, SPI, CPI, las **tres variantes clásicas de EAC**, ETC, VAC y TCPI.
2. **Línea base congelada.** Aprobás una foto del plan (BAC + presupuesto,
   pesos y fechas de cada paquete) y el desempeño se mide **contra esa foto**,
   no contra el plan vivo. Editar un paquete después ya no mueve la base;
   cambiar el alcance exige una **nueva versión** (rebaselining), con historial
   completo y aviso de divergencia — auditable.
3. **Pronóstico de plazo (Earned Schedule).** Traduce el avance ganado a
   *tiempo* y proyecta una **fecha de finalización** — no solo el sobrecosto.
3. **Panel "Requiere decisión".** Arriba de todo, ordenado por **exposición
   económica**, con el **motivo explícito** de cada paquete fuera de plan.
4. **Conclusión escrita primero.** Cada pantalla abre con un veredicto en
   prosa; los gráficos vienen después, nunca antes.
5. **Curva S.** Valor planificado (perfil S), ganado y real a lo largo de los
   cortes, en una sola vista de líneas.
6. **Multiproyecto con persistencia local.** Crear/editar proyectos y paquetes,
   cargar cortes de avance y mirar el proyecto a **cualquier fecha de corte
   histórica**. Todo guardado en el navegador (IndexedDB).
7. **Import de cronograma (CSV).** Traé la WBS/cronograma desde Excel / MS
   Project / P6 exportado a CSV; tolera fechas `DD/MM/AAAA` y separadores de
   miles, con **previsualización y validación** antes de importar.
8. **Export a CSV y reporte PDF.** El corte actual sale a CSV para Excel, o a un
   **reporte imprimible** (conclusión + decisión + consolidado + plazo + curva S
   + detalle) que el navegador guarda como PDF para el comité.

### Reglas de diseño de la interfaz

La interfaz sigue reglas deliberadas, pensadas para lectura de gestión:

- 🧾 **Cada pantalla abre con una conclusión escrita**, no con gráficos.
- ⚖️ **Ningún número absoluto sin su comparación contra plan** (SPI/CPI vs 1.00,
  avance vs plan, EAC vs BAC, fin pronosticado vs planificado).
- 🚫 **Nada de donuts ni gauges.** Sólo texto, tablas y una curva S de líneas.
- 🔺 **El panel "Requiere decisión" va arriba**, ordenado por exposición, con el
  motivo de cada ítem.
- 🎨 **Tema claro, sobrio y de alta densidad** (aire de planilla de control):
  Inter para interfaz e IBM Plex Mono para cifras; acentos con semántica fija
  (ámbar = atención, rojo = desvío, verde = dentro de plan).

---

## 📐 Cómo funciona el cálculo

### Indicadores EVM (`src/core/evm.ts`)

Todas funciones **puras**, sin React, cubiertas por tests. A una fecha de corte:

| Indicador | Fórmula | Nota |
|-----------|---------|------|
| **SV** | EV − PV | variación de plazo (en dinero) |
| **CV** | EV − AC | variación de costo |
| **SPI** | EV / PV | `null` si PV = 0 |
| **CPI** | EV / AC | `null` si AC = 0 |
| **EAC** (`cpi`) | BAC / CPI | el desvío de costo es sistémico |
| **EAC** (`budgetRate`) | AC + (BAC − EV) | lo que falta se ejecuta al presupuesto original |
| **EAC** (`cpiSpi`) | AC + (BAC − EV) / (CPI × SPI) | pondera costo y plazo |
| **ETC** | EAC − AC | por variante |
| **VAC** | BAC − EAC | por variante |
| **TCPI** (BAC) | (BAC − EV) / (BAC − AC) | eficiencia necesaria para cerrar en presupuesto |
| **TCPI** (EAC) | (BAC − EV) / (EAC − AC) | eficiencia necesaria para cerrar en el EAC |

> **División por cero:** los indicadores indefinidos devuelven `null` (nunca
> `Infinity` ni `NaN`). `null` significa *"sin información suficiente todavía"*,
> que es distinto de un valor numérico.

### Time-phasing con curva S

El **Planned Value (PV)** se reparte en el tiempo con una **curva S** (smoothstep
de Hermite, `3t² − 2t³`): arranque lento, aceleración en el medio y
desaceleración al final — el perfil típico de una obra. Es intercambiable por
`linearCurve` u otra `ProgressCurve`.

### Earned Schedule (`src/core/earnedSchedule.ts`)

El SV en dinero es engañoso: al final del proyecto tiende a 0 aunque se termine
tardísimo. **Earned Schedule** traduce el avance a tiempo:

- **ES** = el momento del plan en que estaba previsto haber ganado lo que hoy se
  ganó (se halla invirtiendo la curva de PV: el `t` tal que `PV(t) = EV`).
- **SV(t)** = ES − AT · **SPI(t)** = ES / AT · **IEAC(t)** = PD / SPI(t).
- De ahí sale una **fecha de fin pronosticada**, comparada contra el plan.

### Línea base (`src/analytics/baseline.ts`)

Sin línea base, el PV se calcula contra el plan vivo (referencia provisoria).
Al **congelar** una línea base se guarda una foto (`Baseline`) con el
presupuesto, peso y fechas de cada paquete y el BAC total. A partir de ahí
**PV, EV y BAC se miden contra esa foto**: editar un paquete no altera la base.
Un **rebaseline** crea una versión nueva y conserva las anteriores. Si la
estructura viva difiere de la base activa, se detecta la **divergencia**
(agregados / quitados / modificados) y se avisa en pantalla.

### WBS jerárquica (`src/analytics/wbs.ts`)

La estructura de trabajo es un árbol (patrón Primavera P6 / MS Project): **solo
las hojas cargan dato** (presupuesto, fechas, avance, costo); los nodos de
resumen muestran el **roll-up** de sus hojas y nunca se tipean, así no hay doble
conteo. El consolidado, la línea base y las decisiones se calculan sobre las
hojas; la tabla de detalle muestra el árbol indentado con los resúmenes.

### Trazabilidad (usuarios + bitácora)

Hay usuarios con **rol** (analista / jefe de proyecto / director / auditor) y un
selector de **sesión**: quien opera queda registrado. Cada mutación (alta/edición/
baja de proyectos, paquetes y cortes; congelar línea base; imports) deja una
**entrada de bitácora inmutable** con usuario, rol, fecha-hora y detalle — la
trazabilidad que pide el reporte a banca multilateral. Se ve en «Actividad».

> Alcance: la persistencia es **local por navegador** (IndexedDB). La sesión
> simula el multiusuario y la bitácora es real, pero la **sincronización entre
> dispositivos/usuarios** requiere un backend con servidor, base de datos y
> autenticación, que no está incluido (es el próximo paso de arquitectura).

### Panel de decisión y exposición

Cada paquete se clasifica (dentro de plan / atención / desvío) por su peor
índice (SPI o CPI). Los que están fuera de plan se listan ordenados por
**exposición** = sobrecosto proyectado a fin de paquete (VAC por CPI), con el
motivo redactado automáticamente.

---

## 🗃️ Modelo de datos

```
Project        id · nombre · tipo · BAC · fechaInicio · fechaFinPlan · moneda
WorkPackage    id · projectId · nombre · presupuesto · peso · fechas plan · responsable
ProgressEntry  id · workPackageId · fechaCorte · avanceFisico (0..1) · costoRealAcum
```

Un paquete acumula **muchos** cortes en el tiempo; a una fecha dada, el "vigente"
es el último corte con fecha ≤ esa fecha. Eso permite mirar el proyecto a
cualquier fecha de corte histórica.

---

## 🧱 Arquitectura

```
pmi-toolbox/
├─ src/
│  ├─ core/            Lógica pura, sin React (fuente de verdad)
│  │  ├─ types.ts          Modelo de datos + tipos del motor
│  │  ├─ evm.ts            Motor EVM (PV/EV/AC, índices, EAC, TCPI, curva S)
│  │  ├─ evm.test.ts       Tests del motor
│  │  ├─ earnedSchedule.ts Earned Schedule (pronóstico de plazo)
│  │  └─ earnedSchedule.test.ts
│  ├─ analytics/       Análisis derivado (puro)
│  │  ├─ decisions.ts      Consolidado, estado por paquete, ítems de decisión
│  │  ├─ resolve.ts        Corte vigente por paquete + historia EV/AC
│  │  ├─ schedule.ts       Fechas del pronóstico de plazo
│  │  └─ status.ts         Clasificación y umbrales
│  ├─ data/           Capa de datos (puerto + adaptadores) — backend-ready
│  │  ├─ repository.ts        Puerto: el contrato de persistencia
│  │  ├─ dexieRepository.ts   Adaptador IndexedDB (Dexie)
│  │  ├─ memoryRepository.ts  Adaptador en memoria (referencia + tests)
│  │  ├─ sync.ts              Cola de cambios + SyncAdapter + mock
│  │  ├─ syncingRepository.ts Decorador: registra y empuja cambios
│  │  └─ index.ts             Armado del repositorio de la app
│  ├─ db/             Esquema Dexie (IndexedDB) + seed
│  │  ├─ db.ts             Esquema y versiones/migraciones
│  │  └─ seed.ts           Datos de ejemplo (con historia de cortes)
│  ├─ store/          Estado con Zustand
│  │  ├─ pmStore.ts        Carga async, selección y CRUD
│  │  └─ selectors.ts      Vista derivada (useProjectView)
│  ├─ fixtures/       Proyecto de ejemplo (seed)
│  ├─ ui/             Interfaz
│  │  ├─ Dashboard.tsx     Tablero
│  │  ├─ components/       Paneles y primitivas
│  │  ├─ forms/            Alta/edición de proyecto, paquetes y cortes
│  │  ├─ conclusion.ts     Redacción de la conclusión de la pantalla
│  │  ├─ export.ts         Export a CSV
│  │  └─ format.ts         Formateadores (moneda, índices, meses)
│  └─ test/setup.ts
├─ tailwind.config.ts  Tokens de paleta y tipografías
└─ vite.config.ts      Vite + Vitest
```

Principio rector: **el `core/` es la única fuente de verdad de los números.** La
UI nunca recalcula un indicador; sólo muestra lo que devuelve el motor.

### Capa de datos backend-ready

Todo el acceso a datos pasa por el **puerto** `Repository` (arquitectura
hexagonal): el store y la UI dependen de ese contrato, no de una base concreta.
Hoy lo cumplen dos adaptadores intercambiables —IndexedDB (`DexieRepository`) y
en memoria (`MemoryRepository`)—, lo que prueba que la app no está atada al
almacenamiento.

Sobre eso, `SyncingRepository` registra cada mutación del usuario como un
`Change` en una **cola persistente** (offline-first) y la empuja a través de un
`SyncAdapter`. Hoy ese adaptador es un **mock** (no hay servidor). Conectar un
backend real —multiusuario sincronizado entre dispositivos— es implementar
`SyncAdapter` contra la API: **nada del store ni de la UI cambia**. Es el paso
que este entorno estático no puede desplegar por sí mismo, pero que la
arquitectura ya deja listo.

---

## 🛠️ Stack

React + Vite + TypeScript · Zustand · Tailwind · Dexie (IndexedDB) · Vitest.
Tipografías self-hosted (Inter · IBM Plex Mono), sin CDN.

---

## 🚀 Puesta en marcha

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # corre la suite de Vitest
npm run typecheck  # chequeo de tipos
npm run build      # build de producción
```

La primera vez, si la base está vacía, se siembra un proyecto de ejemplo (un
tramo de gasoducto con planta compresora) para poder explorar el tablero.

---

## 🗺️ Roadmap

En orden de valor para el perfil PMO / control de proyectos:

- [x] Motor EVM puro y testeado
- [x] Tablero con conclusión escrita, panel de decisión y curva S
- [x] Persistencia local (Dexie) + estado (Zustand)
- [x] Earned Schedule (pronóstico de fecha de fin)
- [x] Export a CSV
- [x] **Línea base congelada** + rebaselining con historial y divergencia
- [x] **Reporte PDF** para comité (vía impresión del navegador)
- [x] **Import de cronograma** CSV (Excel / MS Project / P6) con validación
- [x] **Import de avances y costos reales** (patrón ERP → EVM) por CSV
- [x] Reporte con **Riesgos & Issues + Próximos pasos** (estándar ISR / PMR)
- [x] EAC/pronóstico como **rango** entre métodos (forecasting por banda)
- [x] **WBS jerárquica** (nodos de resumen con roll-up de sus hojas)
- [x] **Usuarios, roles y bitácora de auditoría** (quién cargó qué corte, y cuándo)
- [x] **Umbrales SPI/CPI sensibles a la etapa** del proyecto (criterio ISR/PMR)
- [x] **Earned Schedule sobre la curva S** (atraso en tiempo, no solo en dinero)
- [x] **Capa de datos backend-ready** (puerto `Repository` + cola de sync + mock)
- [~] Sincronización multi-dispositivo: **arquitectura lista** (`SyncAdapter`);
      falta el servidor real, que este entorno estático no despliega
- [ ] Notificación a Slack cuando un paquete cruza a "desvío"

---

## ✅ Estado de tests

El motor de cálculo (EVM + Earned Schedule) está cubierto por tests de Vitest,
incluyendo casos borde: avance cero, costo cero, división por cero y proyecto
terminado.

```bash
npm test
```
