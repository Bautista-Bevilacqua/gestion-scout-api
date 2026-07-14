# node-api — Backend de Gestión Scout 108

API REST para el sistema de gestión del Grupo Scout 108. Ver también [../CLAUDE.md](../CLAUDE.md) para el contexto general del sistema (Frontend + Backend).

## Stack

- **Node.js + TypeScript** (`strict: true`), ESM puro (`type: "module"`, imports locales con sufijo `.js` aunque el archivo sea `.ts`, patrón `NodeNext`).
- **Express 5** (no v4 — cambia el manejo de errores async respecto a versiones previas).
- **PostgreSQL sin ORM**: driver `pg` (`Pool`) con SQL crudo parametrizado en cada `*.service.ts`. DB alojada en **Neon** (Postgres serverless). No hay `schema.prisma` ni carpeta de migraciones — el esquema solo existe implícito en las queries.
- `bcrypt` (hash de passwords), `jsonwebtoken` (JWT), `helmet`, `express-rate-limit`, `cors`, `multer` + `multer-storage-cloudinary` + `cloudinary` (legajos/adjuntos), `node-cron` (tareas programadas), `@getbrevo/brevo`/fetch directo a la API HTTP de Brevo (mail transaccional — `nodemailer`/`resend` están en dependencies pero no se usan en el código activo).

## Arrancar en desarrollo

```
npm run dev     # nodemon + tsx sobre src/index.ts, puerto 3000 por defecto (PORT)
npm run build   # tsc -> dist/
npm start       # node dist/index.js (requiere build previo)
```

No hay script `test` ni `lint`.

### Variables de entorno (`.env`, no versionado, no hay `.env.example`)

| Variable | Uso |
|---|---|
| `DATABASE_URL` | connection string Postgres/Neon |
| `JWT_SECRET` | firma de JWT |
| `FRONTEND_URL`, `FRONTEND_URL_WWW` | whitelist de CORS |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | subida de legajos |
| `BREVO_API_KEY` | envío de mails transaccionales (`mailer.service.ts`) |
| `PORT` | opcional, default 3000 |

Al pedir cambios que dependan de configuración, no asumas que todas estas variables están seteadas — `mailer.service.ts` tiene try/catch para no romper el flujo si falla el envío de mail.

## Estructura (`src/`)

Arquitectura en capas por tipo (no por feature), sin carpeta `repository/`:

```
src/
  index.ts              # entrypoint real: crea la app Express, middlewares, monta rutas, cron, listen()
  app.ts                # VACÍO (0 bytes) — no es el bootstrap, ignorar
  config/db.ts           # Pool de pg (Neon, ssl rejectUnauthorized:false)
  controllers/*.controller.ts   # req/res, delega a services, decide status codes
  routes/*.routes.ts            # Router de Express, aplica middlewares de auth/rol
  services/*.service.ts         # lógica de negocio + SQL directo contra el pool
  models/*.model.ts             # solo interfaces TS (no son modelos ORM)
  middlewares/
    auth.middleware.ts   # verificarToken (JWT) y verificarRol(rolesPermitidos)
    upload.middleware.ts # multer + CloudinaryStorage
```

Convención de nombres: `recurso.controller.ts` / `recurso.service.ts` / `recurso.routes.ts`. Todo en español.

**Nota**: `src/app.ts` está vacío por un refactor viejo — el bootstrap real está en `index.ts`. No buscar ahí.

## Modelo de datos (inferido de las queries SQL — no hay fuente única de verdad)

- `usuarios` — dirigentes/admins: `id_usuario, nombre, apellido, dni, email, password (bcrypt), rol, debe_cambiar_password, creado_en`. `rol` ∈ `ADMIN | JEFE_GRUPO | ADMINISTRACION | MANADA | UNIDAD | CAMINANTES | ROVERS`.
- `familias` — `id_familia, apellido_familia, nombre_padre, nombre_madre, telefono_padre, telefono_madre, email, direccion, fecha_creacion`.
- `beneficiarios` (los scouts) — `id_beneficiario, id_familia (FK), nombre, apellido, dni, fecha_nacimiento, rama_actual, fecha_ingreso, saldo_a_favor`.
- `historial_beneficiarios` — bitácora de novedades: `id_beneficiario, descripcion, id_usuario, fecha`.
- `conceptos_cobro` — conceptos de cuota: `id_concepto, nombre, monto_efectivo, monto_transferencia, alcance ('GRUPO' o rama), fecha_vencimiento, archivado, actualizada, fecha_creacion`.
- `cargos` — deuda generada a un beneficiario, desde un concepto o de forma personalizada: `id_cargo, id_beneficiario (FK), id_concepto (FK, NULLABLE), monto_efectivo, monto_transferencia, descripcion (TEXT, NULLABLE), estado ('PENDIENTE'|'PARCIAL'|'PAGADO'), fecha_creacion`. `id_concepto` es NULL cuando el cargo es una "deuda personalizada" (ver más abajo); en ese caso `descripcion` puede tener el motivo cargado a mano.
- `pagos` — pagos sobre un cargo: `id_pago, id_cargo (FK), monto_pagado, metodo_pago ('EFECTIVO'|'TRANSFERENCIA'|'MERCADOPAGO'|'SALDO_A_FAVOR'), id_usuario_cobrador (FK), fecha_pago`.
- `movimientos_caja` — libro mayor: `id, tipo ('INGRESO'|'EGRESO'), monto, concepto, id_usuario, id_pago (FK opcional), comprobante, persona_involucrada, fecha`.
- `eventos` — calendario: `id_evento, titulo, descripcion, fecha_inicio, fecha_fin, alcance, color, id_usuario`.
- `documentos_legajo` — adjuntos en Cloudinary: `id_documento, id_beneficiario (FK), nombre_original, nombre_archivo (URL), tipo_archivo, public_id, fecha_subida`.

Relaciones: `Familia 1—N Beneficiario`, `Beneficiario 1—N Cargo`, `Concepto 1—N Cargo`, `Cargo 1—N Pago`, `Pago 1—1(opt) MovimientoCaja`, `Beneficiario 1—N DocumentoLegajo/HistorialBeneficiario`.

Lógica no trivial en `cargo.service.ts`: sistema de "saldo a favor" (billetera virtual), pagos divididos entre saldo y método físico, transacciones explícitas `BEGIN/COMMIT/ROLLBACK` para mantener consistencia entre `cargos`, `pagos`, `movimientos_caja` y `beneficiarios.saldo_a_favor`. **Si tocás algo de pagos/cargos, replicar el patrón transaccional existente.**

Si agregás o cambiás columnas/tablas, actualizá esta sección — no hay otra fuente de verdad del esquema en el repo.

### Deudas personalizadas (sin concepto)

Feature agregada para que un dirigente pueda cargarle una deuda puntual a UN beneficiario (monto libre, sin tener que crear un `ConceptoCobro` genérico solo para ese caso — reemplaza el Excel que usaban antes para deudas "sueltas").

- `crearCargoPersonalizado(idBeneficiario, monto, descripcion?)` en `cargo.service.ts` inserta un `cargo` con `id_concepto = NULL`, mismo `monto` en `monto_efectivo` y `monto_transferencia` (no hay precio diferenciado por método de pago para estas deudas), y `descripcion` opcional.
- **Todas** las queries que antes hacían `JOIN conceptos_cobro` sobre `cargos` (listado de cuenta corriente, cobro individual, cobro múltiple, mail de recibo) son ahora `LEFT JOIN`, con `COALESCE(con.nombre, c.descripcion, 'Deuda personalizada')` como nombre a mostrar. Si agregás una query nueva que una `cargos` con `conceptos_cobro`, usá el mismo patrón — un INNER JOIN ahí rompe (o directamente no puede cobrar) cualquier cargo personalizado.
- No hay endpoint para editar una deuda personalizada ya creada — se borra (`DELETE /api/cargos/:idCargo`, solo si está `PENDIENTE`) y se vuelve a cargar.

## Autenticación y autorización

- JWT firmado con `JWT_SECRET`, expira en 8h (`auth.service.ts`).
- `POST /api/auth/login` → valida email+password (bcrypt.compare), devuelve `{ token, usuario }`.
- Middleware `verificarToken`: exige `Authorization: Bearer <token>`, setea `req.usuario`. Aplicado en casi todas las rutas.
- Middleware `verificarRol(rolesPermitidos: string[])`: usado explícitamente solo en `legajo.routes.ts`. En el resto de las rutas la restricción por rol/rama se hace **dentro del service**, filtrando en la query SQL — no asumas que el middleware es la única barrera de autorización.
- `POST /api/auth/registrar-admin` **no tiene protección de auth** (endpoint abierto para el setup inicial). Tenerlo en cuenta como riesgo de seguridad conocido si se toca esa zona.
- Cambio de password obligatorio vía flag `debe_cambiar_password` → `POST /api/auth/cambiar-password`.
- Rate limiting: 10 intentos/15min en `/api/auth/login`, 1000 req/15min en el resto de `/api/`. `helmet()` + CORS con whitelist (`FRONTEND_URL`, `FRONTEND_URL_WWW`, `http://localhost:4200`).

## Endpoints (prefijo `/api`)

- **Auth** `/auth`: `POST /login`, `POST /registrar-admin`, `POST /cambiar-password`
- **Usuarios** `/usuarios`: CRUD estándar
- **Familias** `/familias`: `GET /` (?q=), `GET/PUT/DELETE /:id`, `POST /`
- **Beneficiarios** `/beneficiarios`: CRUD, `GET /familia/:idFamilia`, `GET/POST /:id/historial`
- **Conceptos** `/conceptos`: `GET/POST /`, `POST /:id/asignar` (genera cargos masivos), `GET /disponibles/:idBeneficiario`, `POST /masivo` (cuotas de varios meses), `DELETE /:id`, `PUT /actualizar-precio/:id`, `PUT /archivar-pagados`, `PUT /:id/archivar`, `GET /archivados`, `PUT /:id/restaurar`
- **Cargos** `/cargos`: `GET /beneficiario/:idBeneficiario`, `POST /individual` (desde concepto), `POST /personalizado` (`idBeneficiario, monto, descripcion?` — deuda sin concepto, ver sección de modelo de datos), `POST /pagar-multiples`, `POST /:idCargo/pagar`, `DELETE /:idCargo`, `POST /beneficiario/:idBeneficiario/cargar-saldo`
- **Caja** `/caja`: `GET /` (?fechaDesde&fechaHasta), `POST /manual`
- **Legajos** `/legajos` (requiere rol ADMIN/JEFE_GRUPO/ADMINISTRACION): `GET/POST /:idBeneficiario`, `DELETE /:idDocumento`
- **Eventos** `/eventos`: CRUD
- **Uploads** `GET /api/uploads/*`: estático
- **Cron**: sincronización nocturna de precios de cuotas a las 00:05 (`node-cron`, definido en `index.ts`)

## Convenciones de código

- No hay ESLint ni Prettier en este repo (a diferencia del Frontend).
- Sin middleware de error centralizado: cada controller hace try/catch y devuelve status codes a mano. Algunos chequean códigos de error de Postgres (`23505` unique violation, `23503` FK violation) para mensajes de negocio — seguir ese patrón al agregar endpoints nuevos.
- Transacciones explícitas (`client.query('BEGIN'/'COMMIT'/'ROLLBACK')`) en operaciones multi-tabla críticas.

## Sin tests, sin CI/CD, sin Docker

No hay tests, ni GitHub Actions, ni Dockerfile. DB gestionada externamente en Neon.
