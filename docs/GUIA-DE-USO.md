# 📖 Guía de uso — PMI Toolbox

Guía práctica para usar la herramienta de punta a punta: desde crear un proyecto
hasta emitir el reporte para el comité. Está pensada para el analista de control
de proyectos / PMO.

> **En una frase:** cargás el plan, congelás una línea base, reportás avance
> físico y costo real en cada corte, y la herramienta te dice —en texto y con
> números— **cómo venís contra ese plan** y **dónde tenés que decidir**.

---

## Índice

1. [Conceptos que conviene tener claros](#1-conceptos-que-conviene-tener-claros)
2. [La pantalla de un vistazo](#2-la-pantalla-de-un-vistazo)
3. [El flujo de trabajo recomendado](#3-el-flujo-de-trabajo-recomendado)
4. [Cómo leer el tablero](#4-cómo-leer-el-tablero)
5. [Cómo interpretar los números](#5-cómo-interpretar-los-números)
6. [Rutinas típicas](#6-rutinas-típicas)
7. [Importar y exportar (formatos CSV)](#7-importar-y-exportar-formatos-csv)
8. [Trazabilidad: sesión y bitácora](#8-trazabilidad-sesión-y-bitácora)
9. [Buenas prácticas y errores comunes](#9-buenas-prácticas-y-errores-comunes)
10. [Preguntas frecuentes y límites](#10-preguntas-frecuentes-y-límites)

---

## 1. Conceptos que conviene tener claros

| Término | Qué es |
|---|---|
| **Proyecto** | La obra o iniciativa que medís. Tiene un **BAC** (presupuesto total), fechas de inicio y fin plan, y una moneda. |
| **Paquete de trabajo** | Una parte del proyecto con su presupuesto, fechas de plan y responsable. |
| **WBS** | La estructura jerárquica de paquetes. Un paquete puede tener **sub-paquetes**. |
| **Hoja** | Un paquete sin sub-paquetes: **es donde se carga el dato** (presupuesto, avance, costo). |
| **Resumen (roll-up)** | Un paquete con sub-paquetes. **No se carga**: sus números son la suma de sus hojas. |
| **Corte** | Una foto del avance a una fecha (*data date*): el % de avance físico y el costo real de cada paquete. |
| **Línea base** | El plan **congelado y aprobado** contra el que se mide todo. Editar un paquete después no la mueve. |
| **PV / EV / AC** | Valor **Planificado** / **Ganado** / **Real** a la fecha de corte. Las tres curvas de EVM. |
| **SPI / CPI** | Índices de **plazo** y de **costo**. 1,00 = en plan; <1 = mal; >1 = bien. |
| **EAC** | *Estimate At Completion*: en cuánto **cerraría** el proyecto al ritmo actual. |
| **Exposición** | El **sobrecosto proyectado** de un paquete (cuánto plata está en juego). Ordena el panel de decisión. |

---

## 2. La pantalla de un vistazo

**Barra superior (toolbar):**

- **Sesión** — quién está operando (tu usuario y rol). Todo lo que hagas queda registrado a tu nombre.
- **Selector de proyecto** — cambia entre proyectos.
- **Selector de corte** — mirá el proyecto a **cualquier fecha de corte histórica**.
- **＋ Corte** — cargar el avance/costo de un corte.
- **Datos** — editar el proyecto y su WBS (paquetes).
- **Línea base vN** — ver/congelar la línea base.
- **Exportar** — bajar el corte a CSV (Excel).
- **Reporte** — abrir el documento imprimible (Guardar como PDF).
- **Actividad** — la bitácora de auditoría.
- **Nuevo proyecto**.

**El tablero (de arriba hacia abajo):**

1. **Cabecera** — nombre, tipo, moneda, fecha de corte, línea base y un **semáforo** de estado.
2. **Conclusión escrita** — el veredicto en texto. *Empezá leyendo esto.*
3. **Requiere decisión** — los paquetes fuera de plan, ordenados por exposición, con el motivo.
4. **Consolidado** — EV / AC / EAC contra plan, y las tres variantes de EAC.
5. **Plazo (Earned Schedule)** — la **fecha de fin pronosticada** contra la planificada.
6. **Curva S** — plan, ganado y real en el tiempo.
7. **Estructura de trabajo (WBS)** — el detalle por paquete, con la jerarquía.

---

## 3. El flujo de trabajo recomendado

El orden importa. Este es el ciclo del analista:

### Paso 1 — Crear el proyecto
**Nuevo proyecto** → nombre, tipo, moneda, **BAC**, fechas de inicio y fin plan.
(Podés también dejar los campos **Riesgos e issues** y **Próximos pasos**, que salen en el reporte.)

### Paso 2 — Cargar la WBS (los paquetes)
**Datos → ＋ Paquete** para cada uno, o **Datos → Importar CSV** para traer todo el
cronograma junto (ver [sección 7](#7-importar-y-exportar-formatos-csv)).

- Para **anidar** un paquete, en el campo **«Depende de (WBS)»** elegí su padre.
- Un paquete que tiene hijos pasa a ser **resumen**: no se le cargan presupuesto ni fechas (se calculan solos).
- Revisá que la suma de las hojas coincida con el **BAC** (el editor te avisa si no).

### Paso 3 — Congelar la línea base
**Línea base → Congelar v1**, con fecha de aprobación y motivo.
A partir de acá, **todo se mide contra esa foto**. Si después cambiás un paquete,
la base **no se mueve**; el sistema te avisa que la estructura «diverge» y podés
congelar una **v2** (rebaseline), quedando el historial.

> Sin línea base, la herramienta usa el plan vivo como referencia **provisoria**.
> Para medir en serio, congelá una.

### Paso 4 — Cargar cortes de avance
**＋ Corte** → elegí la fecha y completá, por paquete, el **% de avance físico** y
el **costo real acumulado**. Guardar.

- El costo es **acumulado** (ACWP), no del período.
- Las filas en blanco no generan corte.
- ¿Tenés muchos datos? **＋ Corte → Importar avances/costos (CSV)** carga todo de una.

### Paso 5 — Leer el tablero
Arrancá por la **conclusión** y el panel **Requiere decisión**. (Ver [sección 4](#4-cómo-leer-el-tablero).)

### Paso 6 — Exportar / reportar
- **Exportar** → CSV con el consolidado, el plazo y el detalle (para Excel).
- **Reporte** → documento imprimible → *Imprimir / Guardar PDF* (para el comité).

---

## 4. Cómo leer el tablero

**Regla de oro: leé de arriba hacia abajo.** El tablero está diseñado para que
lo primero que veas sea la conclusión y lo que hay que decidir.

- **Conclusión escrita.** Un párrafo que dice si el proyecto está atrasado y/o
  sobre presupuesto, con los números clave y su comparación contra plan. Incluye
  la **banda** de cierre proyectado (de un método a otro).
- **Requiere decisión.** Cada ítem es un paquete fuera de plan. Están **ordenados
  por exposición** (el de arriba es el que más plata pone en juego) y traen el
  **motivo** (CPI/SPI, cuánto proyecta cerrar, VAC). Su responsable figura abajo.
- **Consolidado — Desempeño contra plan.** Tres tarjetas: **EV** (lo ganado) vs
  lo planificado, **AC** (lo gastado) vs lo ganado, y **EAC (CPI)** vs el BAC.
  Debajo, las **tres variantes de EAC** (el rango de cierre según el supuesto).
- **Plazo — Earned Schedule.** La **fecha de fin pronosticada** al ritmo actual,
  comparada contra la planificada, con SPI(t) y SV(t) en meses. (A diferencia del
  atraso en plata, este atraso está en **tiempo**.)
- **Curva S.** La línea punteada es el **plan** (PV). El **ganado** (EV, negro) por
  debajo del plan = atraso; el **real** (AC, ámbar) por encima del ganado = sobrecosto.
- **Estructura de trabajo (WBS).** El detalle por paquete. Los **resúmenes** van en
  negrita con el roll-up de sus hijos; las **hojas**, con su dato. El avance se
  muestra siempre **contra el plan** y SPI/CPI **contra 1,00**.

---

## 5. Cómo interpretar los números

**Semáforo (estado):**

| Color | Significa | Umbral (SPI o CPI) |
|---|---|---|
| 🟢 **Dentro de plan** | ok | ≥ 0,98 |
| 🟡 **Atención** | vigilar | 0,90 – 0,98 |
| 🔴 **Desvío** | fuera de plan | < 0,90 |

El estado de un paquete es **el peor** de sus dos índices (plazo o costo).

**Índices (adimensionales, comparar contra 1,00):**
- **SPI = EV / PV** — desempeño de **plazo**. 0,80 = ganaste el 80% de lo que debías a la fecha.
- **CPI = EV / AC** — desempeño de **costo**. 0,80 = por cada $1 gastado ganaste $0,80.

**Proyecciones (en plata):**
- **EAC** — en cuánto cierra. Tres métodos:
  - *CPI*: si el desvío de costo es **permanente** (el más usado).
  - *presupuesto restante*: si lo que falta se hace **al valor original**.
  - *CPI×SPI*: pondera también el **atraso**.
- **VAC = BAC − EAC** — el desvío proyectado. Negativo = sobrecosto.
- **TCPI** — la **eficiencia que necesitás** en lo que resta para cerrar en presupuesto.
  Si es > ~1,10, cerrar dentro del BAC ya es poco realista.

**Plazo:**
- **Fin pronosticado vs fin planificado** — cuántos **meses** de atraso/adelanto proyecta.

---

## 6. Rutinas típicas

**Cierre de mes (la principal):**
1. Poné la **sesión** en tu usuario.
2. **＋ Corte** (o **Importar avances/costos**) con el avance certificado y el costo real del ERP/planilla.
3. Leé la **conclusión** y el panel **Requiere decisión** — ese es el orden del día de la reunión de avance.
4. **Reporte → Guardar PDF** para el acta.

**Antes del comité de dirección:**
- Actualizá **Riesgos e issues** y **Próximos pasos** (Datos → Editar proyecto).
- **Reporte** → PDF, con la curva S y el top de exposición.

**Seguimiento semanal (rápido):**
- Mirá solo el panel **Requiere decisión** y el **TCPI**: ¿lo que exijo para cerrar en presupuesto es alcanzable?

**Cambió el alcance (rebaseline):**
- Ajustá los paquetes en **Datos**. La cabecera dirá «WBS diverge».
- **Línea base → Congelar v2** con el motivo del cambio. Queda el historial.

---

## 7. Importar y exportar (formatos CSV)

Los CSV se pueden **pegar** o **subir** como archivo. Aceptan separador `,` o `;`,
fechas `AAAA-MM-DD` o `DD/MM/AAAA`, y montos con separadores de miles (`1.250.000`).
Toda importación **previsualiza y valida** antes de aplicar; las filas con error no entran.

### Importar cronograma (paquetes) — *Datos → Importar CSV*
Columnas: **nombre, presupuesto, inicio, fin** (y opcionales **peso, responsable**).

```csv
nombre,presupuesto,peso,inicio,fin,responsable
Ingeniería de detalle,850000,3.7,2025-09-01,2026-03-31,M. Alcaraz
Obras civiles,3100000,13.4,2026-01-15,2026-12-15,R. Ibáñez
```

### Importar avances/costos — *＋ Corte → Importar avances/costos (CSV)*
Columnas: **paquete, fecha, avance, costo**. El `avance` va en % (0–100); el `costo`
es acumulado. Empareja por **nombre de paquete**. Si ya existe un corte de ese
paquete y fecha, lo **sobrescribe**.

```csv
paquete,fecha,avance,costo
Ingeniería de detalle,2026-06-30,100,910000
Obras civiles planta compresora,2026-06-30,42,1650000
```

### Exportar
- **Exportar** → CSV del corte (metadatos + consolidado + plazo + detalle por paquete).
- **Reporte** → documento imprimible; desde el navegador, *Imprimir → Guardar como PDF*.

---

## 8. Trazabilidad: sesión y bitácora

- **Sesión.** Elegí tu usuario en la toolbar (analista / jefe de proyecto / director /
  auditor). Cada cambio queda atribuido a vos.
- **Actividad.** Abre la **bitácora**: un registro **inmutable** de quién hizo qué y
  cuándo (altas, ediciones, bajas, cortes cargados, líneas base congeladas, imports).
  Es la trazabilidad que pide el reporte a banca multilateral.

> Las horas de la bitácora están en **UTC**.

---

## 9. Buenas prácticas y errores comunes

- ✅ **Congelá la línea base antes de medir en serio.** Sin base, el plan es provisorio.
- ✅ **No edites paquetes de la base sin re-baselinar.** Si cambia el alcance, congelá una v2 con motivo — no toques la vieja.
- ✅ **El costo es acumulado (ACWP), no del período.** Cargá el total gastado a la fecha, no el gasto del mes.
- ✅ **Cargá el dato en las hojas, no en los resúmenes.** Los resúmenes se calculan solos.
- ✅ **La suma de las hojas debe dar el BAC.** El editor de datos te avisa si no coincide.
- ⚠️ **Un EAC no es una certeza.** Mirá la **banda** (los tres métodos) y el TCPI para calibrar cuán realista es.
- ⚠️ **Elegí bien la sesión antes de cargar.** Lo que hagas queda a tu nombre en la bitácora.

---

## 10. Preguntas frecuentes y límites

**¿Dónde se guardan los datos?**
En tu **navegador** (IndexedDB). No hay servidor: los datos viven en ese equipo y
ese navegador.

**¿Es multiusuario real?**
La **sesión** y la **bitácora** simulan el multiusuario y son reales, pero **no hay
sincronización entre dispositivos**. Compartir datos entre personas requiere un
backend con servidor y autenticación (pendiente, es el próximo paso de arquitectura).

**¿Puedo mirar el proyecto en una fecha pasada?**
Sí: el **selector de corte** te deja ver el estado a cualquier fecha de corte cargada.

**¿Cómo empiezo de cero?**
La primera vez se carga un **proyecto de ejemplo** (un gasoducto). Podés crear los
tuyos con **Nuevo proyecto** y borrar el de ejemplo desde **Datos → Editar proyecto → Borrar**.

**¿Qué pasa si borro un paquete de resumen?**
Se borra **en cascada** todo su sub-árbol (y sus cortes). El sistema te lo confirma.

**Atajos:** `Esc` cierra los diálogos; hacer clic fuera de un modal también.

---

*Para el detalle técnico (arquitectura, fórmulas EVM, roadmap) ver el
[README](../README.md).*
