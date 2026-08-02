# PMI Toolbox — Diseño de la API de backend

Guía de diseño para el servidor que convierte a PMI Toolbox en una herramienta
**multiusuario sincronizada entre dispositivos**, sin reescribir el cliente.

> **Estado.** El cliente ya está *backend-ready*: todo el acceso a datos pasa por
> el puerto [`Repository`](../src/data/repository.ts), y la sincronización por el
> contrato [`SyncAdapter`](../src/data/sync.ts). Hoy el adaptador es un mock.
> **Conectar este backend = implementar `SyncAdapter` contra esta API.** Nada del
> store ni de la UI cambia. Este documento especifica esa API y el servidor que
> la sirve; no incluye la implementación (requiere hosting, fuera del entorno
> estático actual).

---

## 1. Objetivos y principios

1. **Offline-first.** El cliente sigue trabajando sin conexión sobre IndexedDB;
   el servidor es la fuente de verdad *compartida* y se reconcilia cuando hay red.
2. **Contrato estable.** El servidor cumple el mismo modelo de datos del cliente
   ([`src/core/types.ts`](../src/core/types.ts)). Sin traducciones raras.
3. **Idempotencia.** Reenviar un cambio ya aplicado no rompe nada (clave: el `id`
   del `Change`). Las redes móviles reintentan.
4. **Trazabilidad íntegra.** La bitácora de auditoría es *append-only* y el actor
   lo sella el servidor desde el token, no el cliente (anti-spoofing).
5. **Autoridad por proyecto.** Un usuario ve y toca sólo los proyectos de su
   organización, según su rol.

Patrón de fondo: **outbox + sync** (cola de cambios local que se empuja) y
**last-write-wins con reloj de servidor** para resolver conflictos, con reglas
especiales por entidad (ver §6).

---

## 2. Arquitectura

```
┌─────────────── Cliente (navegador / PWA) ───────────────┐
│  UI ── store (Zustand) ── Repository (puerto)            │
│                              │                           │
│                    SyncingRepository                     │
│                    ├─ DexieRepository  (IndexedDB, caché)│
│                    └─ ChangeQueue  →  HttpSyncAdapter ───┼──► HTTPS
└─────────────────────────────────────────────────────────┘        │
                                                                     ▼
┌─────────────── Servidor (API REST) ─────────────────────┐
│  Auth (JWT) · Autorización por proyecto/rol              │
│  /sync/push  /sync/pull   (protocolo de sync)            │
│  /auth/*  /projects  /users  (REST de conveniencia)      │
│                              │                           │
│                        PostgreSQL                        │
│         (entidades + metadatos de sync + outbox server)  │
└──────────────────────────────────────────────────────────┘
```

- El **cliente** nunca habla con Postgres; habla con la API.
- El **`HttpSyncAdapter`** (nuevo, en el cliente) traduce la `ChangeQueue` a
  llamadas `/sync/push` y aplica lo que vuelve de `/sync/pull` sobre el
  `DexieRepository` local.
- El **servidor** es stateless salvo la base; escala horizontal detrás de un LB.

---

## 3. Modelo de datos del servidor (PostgreSQL)

Espeja las entidades del cliente y agrega **metadatos de sync** a cada tabla:

- `server_seq BIGSERIAL` — reloj lógico monotónico global (cursor de `pull`).
- `updated_at TIMESTAMPTZ` — reloj físico del servidor (para LWW legible).
- `rev INTEGER` — número de revisión por fila (optimistic concurrency).
- `deleted_at TIMESTAMPTZ NULL` — *tombstone*: los borrados no se eliminan, se
  marcan, para poder propagarlos por `pull`.
- `org_id`, `updated_by` — pertenencia y último actor.

```sql
-- Organización y membresía (multi-tenant simple) -----------------------------
CREATE TABLE orgs (
  id          UUID PRIMARY KEY,
  nombre      TEXT NOT NULL
);

CREATE TABLE users (
  id          UUID PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES orgs(id),
  nombre      TEXT NOT NULL,
  email       CITEXT UNIQUE NOT NULL,
  rol         TEXT NOT NULL CHECK (rol IN ('analista','jefe_proyecto','director','auditor')),
  password_hash TEXT,                       -- o proveedor externo (OIDC)
  server_seq  BIGINT NOT NULL DEFAULT nextval('global_seq'),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  rev         INTEGER NOT NULL DEFAULT 1,
  deleted_at  TIMESTAMPTZ
);

-- Secuencia lógica global compartida por todas las entidades sincronizables ---
CREATE SEQUENCE global_seq;

CREATE TABLE projects (
  id            UUID PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES orgs(id),
  nombre        TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('obra_civil','industrial','ti','servicios')),
  bac           NUMERIC(18,2) NOT NULL,
  fecha_inicio  DATE NOT NULL,
  fecha_fin_plan DATE NOT NULL,
  moneda        TEXT NOT NULL,              -- ISO 4217
  riesgos       TEXT,
  proximos_pasos TEXT,
  server_seq    BIGINT NOT NULL DEFAULT nextval('global_seq'),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES users(id),
  rev           INTEGER NOT NULL DEFAULT 1,
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE work_packages (
  id             UUID PRIMARY KEY,
  project_id     UUID NOT NULL REFERENCES projects(id),
  parent_id      UUID REFERENCES work_packages(id),
  nombre         TEXT NOT NULL,
  presupuesto    NUMERIC(18,2) NOT NULL,
  peso           NUMERIC(18,4) NOT NULL,
  fecha_inicio_plan DATE NOT NULL,
  fecha_fin_plan DATE NOT NULL,
  responsable    TEXT NOT NULL DEFAULT '',
  server_seq     BIGINT NOT NULL DEFAULT nextval('global_seq'),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID REFERENCES users(id),
  rev            INTEGER NOT NULL DEFAULT 1,
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX ON work_packages (project_id);

CREATE TABLE progress_entries (
  id              UUID PRIMARY KEY,
  work_package_id UUID NOT NULL REFERENCES work_packages(id),
  fecha_corte     DATE NOT NULL,
  avance_fisico   NUMERIC(6,4) NOT NULL CHECK (avance_fisico BETWEEN 0 AND 1),
  costo_real_acum NUMERIC(18,2) NOT NULL,
  server_seq      BIGINT NOT NULL DEFAULT nextval('global_seq'),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES users(id),
  rev             INTEGER NOT NULL DEFAULT 1,
  deleted_at      TIMESTAMPTZ,
  UNIQUE (work_package_id, fecha_corte)     -- un corte por paquete y fecha
);

-- Línea base: la cabecera + sus ítems (foto congelada). Inmutable salvo `activa`.
CREATE TABLE baselines (
  id             UUID PRIMARY KEY,
  project_id     UUID NOT NULL REFERENCES projects(id),
  version        INTEGER NOT NULL,
  fecha_aprobacion DATE NOT NULL,
  motivo         TEXT NOT NULL,
  bac            NUMERIC(18,2) NOT NULL,
  activa         BOOLEAN NOT NULL,
  items          JSONB NOT NULL,            -- BaselineItem[] (foto; no cambia)
  server_seq     BIGINT NOT NULL DEFAULT nextval('global_seq'),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID REFERENCES users(id),
  rev            INTEGER NOT NULL DEFAULT 1,
  deleted_at     TIMESTAMPTZ,
  UNIQUE (project_id, version)
);

-- Bitácora: append-only, inmutable. No lleva rev/deleted_at (nunca se edita).
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id),
  ts          TIMESTAMPTZ NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id),
  user_nombre TEXT NOT NULL,
  user_rol    TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('crear','editar','borrar','congelar','importar')),
  entity      TEXT NOT NULL CHECK (entity IN ('proyecto','paquete','corte','linea_base')),
  resumen     TEXT NOT NULL,
  server_seq  BIGINT NOT NULL DEFAULT nextval('global_seq')
);
CREATE INDEX ON audit_log (project_id, ts DESC);

-- Idempotencia del push: recuerda qué Change.id ya se aplicó.
CREATE TABLE applied_changes (
  change_id   UUID PRIMARY KEY,
  user_id     UUID NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Notas de mapeo cliente ↔ servidor:

| Cliente (`camelCase`) | Servidor (`snake_case`) |
|---|---|
| `workPackageId`, `fechaCorte`, `avanceFisico`, `costoRealAcum` | `work_package_id`, `fecha_corte`, `avance_fisico`, `costo_real_acum` |
| `fechaInicioPlan` / `fechaFinPlan` | `fecha_inicio_plan` / `fecha_fin_plan` |

El adaptador HTTP hace esta traducción en un solo lugar (§8).

---

## 4. Autenticación y autorización

- **Auth:** `POST /auth/login` (email + password) → **access token** JWT de vida
  corta (≈15 min) + **refresh token** (cookie httpOnly, ≈30 días). Alternativa
  recomendada para empresa: **OIDC** (Google/Microsoft) y prescindir de
  `password_hash`.
- **Claims del JWT:** `sub` (userId), `org` (orgId), `rol`.
- **Autorización:**
  - Todo request se filtra por `org_id = jwt.org`. Nunca se cruza organización.
  - Roles (permisos sugeridos):

    | Acción | analista | jefe_proyecto | director | auditor |
    |---|:---:|:---:|:---:|:---:|
    | Cargar cortes / editar paquetes | ✅ | ✅ | — | — |
    | Crear proyecto / congelar línea base | — | ✅ | ✅ | — |
    | Borrar proyecto | — | — | ✅ | — |
    | Leer todo + bitácora | ✅ | ✅ | ✅ | ✅ |

  - El servidor **rechaza** (`403`) un `Change` cuyo rol no autoriza esa
    mutación, y lo informa en la respuesta de push (no aborta el lote).

---

## 5. Endpoints

REST de conveniencia + los dos endpoints de sync (el corazón).

| Método | Ruta | Propósito |
|---|---|---|
| `POST` | `/auth/login` | Login → tokens |
| `POST` | `/auth/refresh` | Renovar access token |
| `POST` | `/auth/logout` | Invalidar refresh |
| `GET`  | `/me` | Usuario actual + org + rol |
| `GET`  | `/users` | Usuarios de la org (para el selector de sesión) |
| `POST` | `/sync/pull` | Traer cambios desde un cursor |
| `POST` | `/sync/push` | Empujar cambios locales |

`GET /projects`, `GET /projects/:id/...` son opcionales: con `sync/pull` alcanza
para hidratar el cliente. Se agregan si se quiere una API REST "clásica" para
integraciones (BI, ETL).

---

## 6. Protocolo de sincronización

### 6.1 Enriquecer el `Change` con snapshot (patrón outbox)

El `Change` actual del cliente lleva `entity`, `op` y `ref` (ids), **no** el
contenido. Para empujar necesitamos el dato. Recomendación: capturar una **foto
del registro al momento de la mutación** (evita carreras si el registro vuelve a
cambiar antes de sincronizar). Es un cambio mínimo y aditivo al tipo existente:

```ts
// src/data/sync.ts  (evolución sugerida, retrocompatible)
export interface Change {
  id: string;
  ts: string;
  entity: SyncEntity;
  op: SyncOp;
  ref: string | string[];
  /** Foto del registro (put/bulkPut). Ausente en delete. */
  payload?: unknown;
}
```

`SyncingRepository.track()` pasa a guardar `payload` con el/los registro(s)
afectado(s). El resto de la app no se entera.

### 6.2 `POST /sync/push`

El cliente envía su cola. El servidor aplica cambio por cambio, **idempotente**.

**Request**
```json
{
  "clientId": "device-abc",
  "changes": [
    { "id": "chg-1", "ts": "2026-08-02T13:00:00Z", "entity": "progress",
      "op": "put", "ref": "pe-9",
      "payload": { "id": "pe-9", "workPackageId": "wp-3",
                   "fechaCorte": "2026-07-31", "avanceFisico": 0.62,
                   "costoRealAcum": 4200000 } },
    { "id": "chg-2", "ts": "2026-08-02T13:00:01Z", "entity": "workPackage",
      "op": "delete", "ref": "wp-7" }
  ]
}
```

**Algoritmo (por cambio, dentro de una transacción por cambio)**
1. Si `change.id ∈ applied_changes` → **skip** (ya aplicado). Idempotencia.
2. Autorizar el `op` según `jwt.rol` para esa `entity`. Si no → `rejected: 403`.
3. Resolver conflicto (§6.4) y aplicar:
   - `put`/`bulkPut`: `INSERT … ON CONFLICT (id) DO UPDATE` si gana el entrante;
     `rev = rev + 1`, `server_seq = nextval`, `updated_by = jwt.sub`.
   - `delete`: set `deleted_at = now()` (+ cascada lógica a hijos, ver §6.5).
4. Registrar `change.id` en `applied_changes`.

**Response**
```json
{
  "results": [
    { "changeId": "chg-1", "status": "applied", "serverSeq": 10245 },
    { "changeId": "chg-2", "status": "rejected", "reason": "forbidden" }
  ],
  "cursor": 10245
}
```

El cliente **des-encola** (`ChangeQueue.markSynced`) los `applied` **y** los
`rejected` no reintenables (403/validación); mantiene en cola los `conflict` que
pida reintentar y los que fallaron por red (no llegan a `results`).

### 6.3 `POST /sync/pull`

Trae todo lo cambiado desde el último cursor conocido por el cliente.

**Request** `{ "since": 10240 }`  (o `null` en el primer arranque → full pull)

**Response**
```json
{
  "cursor": 10245,
  "entities": {
    "projects":       [ { "...": "..." } ],
    "workPackages":   [ { "...": "...", "deleted": false } ],
    "progressEntries":[ ... ],
    "baselines":      [ ... ],
    "users":          [ ... ],
    "auditLog":       [ ... ]
  }
}
```

- Devuelve filas con `server_seq > since`, **incluidas las tombstone**
  (`deleted_at != null` → `deleted: true`), para que el cliente borre local.
- El cliente aplica en orden de dependencia (projects → workPackages → progress →
  baselines) y guarda el nuevo `cursor` en localStorage.
- Paginar con `limit` + `cursor` si el delta es grande.

### 6.4 Resolución de conflictos (por entidad)

| Entidad | Política |
|---|---|
| `project`, `workPackage`, `progressEntry` | **Last-Write-Wins** por `updated_at` del servidor. Si el entrante es más nuevo, gana; si no, se descarta y se responde `applied` (el cliente ya recibirá la versión ganadora por `pull`). Opcional: `rev` esperado para *optimistic concurrency* y responder `conflict`. |
| `baseline` (crear) | **Inmutable.** Colisión de `(project_id, version)` → `rejected: version_taken`; el cliente recongela con la versión siguiente. |
| `baseline` (activar) | Transacción server-side: al marcar una `activa=true`, el servidor pone `activa=false` a las demás del proyecto (igual que `freezeBaseline` local). |
| `auditLog` | **Append-only**, nunca conflictúa. El servidor **re-sella** `user_id/nombre/rol` y `ts` desde el token (ignora lo que mande el cliente) para que la bitácora no sea falsificable. |
| `user` | Gestionado por admin/OIDC; el cliente no crea usuarios vía sync. |

`progressEntry` merece nota: la restricción `UNIQUE(work_package_id, fecha_corte)`
hace que "cargar el mismo corte dos veces" sea un **upsert por (paquete, fecha)**,
no un duplicado — idéntico a la semántica del cliente (`importProgress`
sobrescribe el corte existente).

### 6.5 Borrados y cascada

`deleteProject`/`deleteWorkPackage` en el cliente ya cascadean. En el servidor,
un `delete` de proyecto marca `deleted_at` en el proyecto **y** en sus paquetes y
cortes; el `pull` propaga todas esas tombstones. Nunca hay `DELETE` físico
mientras haya clientes que puedan no haber sincronizado (retención configurable;
p. ej. purgar tombstones > 90 días).

---

## 7. Ciclo de sincronización del cliente

```
Al arrancar / recuperar conexión / cada N s / tras cada mutación:
  1) push()  → vaciar la ChangeQueue    (§6.2)
  2) pull(since=cursor) → aplicar deltas (§6.3)
  3) guardar nuevo cursor
Disparadores: online event, visibilitychange, intervalo, y el flush
que SyncingRepository ya invoca tras cada mutación.
```

Todo esto vive **dentro del `HttpSyncAdapter`**; `SyncingRepository` ya llama a
`flush()` (push) tras cada cambio. El `pull` se agenda además por tiempo/eventos.

---

## 8. `HttpSyncAdapter` (cliente) — boceto

Implementa el contrato existente [`SyncAdapter`](../src/data/sync.ts). Es el
**único** archivo nuevo del cliente para pasar de mock a servidor real.

```ts
import type { Change, PushResult, SyncAdapter } from './sync';

export class HttpSyncAdapter implements SyncAdapter {
  readonly name = 'http';
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null,
  ) {}

  private async post(path: string, body: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.getToken() ?? ''}`,
      },
      body: JSON.stringify(body),
      credentials: 'include',           // refresh cookie
    });
    if (!res.ok) throw new Error(`sync ${path} → ${res.status}`); // deja en cola
    return res.json();
  }

  async push(changes: Change[]): Promise<PushResult> {
    const { results } = await this.post('/sync/push', { changes });
    // Des-encolar aplicados y rechazos no reintenables.
    const acceptedIds = results
      .filter((r: any) => r.status === 'applied' || r.reason === 'forbidden')
      .map((r: any) => r.changeId);
    return { acceptedIds };
  }

  async pull(sinceTs: string | null) {
    // (En la práctica el cursor es numérico serverSeq, guardado aparte.)
    const { cursor, entities } = await this.post('/sync/pull', { since: sinceTs });
    // aplicar `entities` sobre el DexieRepository local … (mapper snake→camel)
    return { changes: [], ts: String(cursor) };
  }
}
```

Y el cableado, en [`src/data/index.ts`](../src/data/index.ts), cambia una línea:

```ts
// export const repo = new SyncingRepository(baseRepo, new ChangeQueue(),
//                                           new MockSyncAdapter(), newId);
export const repo = new SyncingRepository(
  baseRepo, new ChangeQueue(),
  new HttpSyncAdapter(import.meta.env.VITE_API_URL, () => session.accessToken),
  newId,
);
```

> El `pull` real necesita escribir sobre el repositorio local; conviene darle al
> adaptador una referencia al `baseRepo` (o exponer un `applyRemote()` en la capa
> de datos). Es el único ajuste de forma respecto del mock, que sólo empuja.

---

## 9. Servidor — boceto del núcleo (`/sync/push`)

Pseudo-Express/Node, para fijar la lógica (no es código de producción):

```ts
app.post('/sync/push', auth, async (req, res) => {
  const { sub: userId, org: orgId, rol } = req.jwt;
  const results = [];
  for (const c of req.body.changes) {
    try {
      await db.tx(async (t) => {
        if (await t.applied(c.id)) return results.push(ok(c, 'applied'));
        if (!can(rol, c.entity, c.op)) return results.push(rej(c, 'forbidden'));
        const seq = await applyChange(t, { change: c, orgId, userId }); // §6.4
        await t.markApplied(c.id, userId);
        results.push(ok(c, 'applied', seq));
      });
    } catch (e) {
      results.push(rej(c, e.code ?? 'error'));
    }
  }
  res.json({ results, cursor: await db.currentSeq() });
});
```

`applyChange` contiene las reglas por entidad de §6.4 (LWW, baseline inmutable,
audit re-sellada, cascada de tombstones).

---

## 10. Seguridad e integridad

- **TLS** obligatorio; tokens en `Authorization: Bearer` + refresh en cookie
  `httpOnly; Secure; SameSite=Lax`.
- **Auditoría no falsificable:** el servidor ignora `userId/rol/ts` del cliente
  en `auditLog` y los sella desde el token y su reloj.
- **Validación** server-side de todos los payloads (mismos invariantes que el
  cliente: `0 ≤ avanceFisico ≤ 1`, montos ≥ 0, fechas ISO, `fin ≥ inicio`).
- **Autorización por proyecto** además de por rol si se quiere granularidad
  (tabla `project_members`).
- **Rate limiting** en `/auth/*` y `/sync/*`.
- **Backups** de Postgres + PITR. La bitácora es el registro legal del proyecto.

---

## 11. Versionado y migraciones

- **API** versionada por prefijo (`/v1/...`). El cliente manda
  `X-Client-Version`; el server puede pedir "actualizá" si hay un breaking.
- **Esquema** del server con migraciones (p. ej. `drizzle`/`prisma`/`sqitch`).
- **Esquema del cliente** (Dexie) ya versiona (v1→v3); mantener alineados los
  campos nuevos en ambos lados.

---

## 12. Despliegue (referencia)

- **Server:** Node 20+ (Express/Fastify) o serverless (Cloud Run / Lambda +
  API Gateway). Stateless.
- **DB:** Postgres gestionado (Neon / RDS / Cloud SQL).
- **Env:** `DATABASE_URL`, `JWT_SECRET`/JWKS, `CORS_ORIGIN`, `REFRESH_TTL`.
- **Cliente:** `VITE_API_URL` apuntando al server; build estático igual que hoy.
- **CI:** correr la suite del cliente + tests de contrato del server (los mismos
  casos de [`repository.contract.test.ts`](../src/data/repository.contract.test.ts)
  sirven de espejo del comportamiento esperado).

---

## 13. Plan de implementación por fases

1. **Fase 0 — Auth + hidratación.** `/auth/login`, `/me`, `/users`,
   `/sync/pull` (full). El cliente lee del server; escritura aún local.
2. **Fase 1 — Push.** `/sync/push` con idempotencia y LWW; `HttpSyncAdapter`
   reemplaza al mock. Multiusuario real (con conflictos LWW).
3. **Fase 2 — Tiempo real (opcional).** WebSocket/SSE que empuja `cursor` nuevo
   para que los clientes hagan `pull` al instante (en vez de por intervalo).
4. **Fase 3 — Integraciones.** REST clásico de lectura para BI/ETL; webhook o
   digest (p. ej. avisar a Slack cuando un paquete cruza a "desvío").

---

*Este diseño se apoya en la capa `src/data/` ya existente. El trabajo del backend
es servir §5–§6; el trabajo del cliente es un único `HttpSyncAdapter` (§8) más el
`applyRemote` del `pull`. El resto de PMI Toolbox no cambia.*
