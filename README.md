# Sistema de generación de casos de prueba funcionales con LLM

Sistema web de apoyo a la tesis *"Sistema usando LLM para la generación de casos de prueba funcionales en el flujo
de compra de monedas virtuales en videojuegos en línea"*. El sistema es genérico: el flujo de compra de monedas
virtuales es el caso de estudio y aparece en los ejemplos de las plantillas.

## Estado: iteración 1 — Módulo 1 (Base de conocimiento)

| Funcionalidad | Estado |
|---|---|
| Inicio de sesión (JWT) con roles Analista QA, Líder QA y Administrador | ✅ |
| Gestión de usuarios y matriz de permisos por rol y módulo | ✅ |
| Catálogos de proyectos y módulos/flujos | ✅ |
| Registro individual (formularios) de requerimientos, reglas de negocio, casos de prueba y defectos | ✅ |
| Códigos automáticos por proyecto (REQ-001, RN-001, CP-001, DEF-001) | ✅ |
| Selección de registros relacionados (varios) desde listas con buscador | ✅ |
| Carga masiva desde Excel, Word y CSV con revisión, corrección y confirmación | ✅ |
| Consulta, búsqueda, edición y eliminación de la información registrada | ✅ |
| Generación de casos con LLM y aprobación/observación por el Líder QA | ⏳ próximas iteraciones |

## Arquitectura

```
frontend/   Angular 20 + Angular Material (SPA)
backend/    NestJS 11 (Node.js 22, TypeScript) + Mongoose
MongoDB 7   Base de datos (local con Docker; en la nube basta cambiar MONGODB_URI, p. ej. MongoDB Atlas)
```

Colecciones principales: `requirements`, `business_rules`, `test_cases`, `defects` (base de conocimiento),
`projects`, `flow_modules` (catálogos), `import_batches`, `import_rows` (lotes de carga masiva en revisión),
`users`, `role_permissions`.

Los campos de cada tipo de información se definen **una sola vez** en
[`backend/src/knowledge/definitions/entity-definitions.ts`](backend/src/knowledge/definitions/entity-definitions.ts).
De esa definición salen los esquemas de MongoDB, la validación (formulario y carga masiva), las plantillas
descargables y los formularios dinámicos del frontend. Para agregar o cambiar un campo solo hay que editar ese archivo.

## Cómo ejecutarlo

### Opción A: todo con Docker

```bash
docker compose up -d --build
```

- Web: http://localhost:8080
- API y documentación Swagger: http://localhost:3000/api/docs

### Opción B: desarrollo local

Requisitos: Node.js 22 y MongoDB (puede levantarlo con `docker compose up -d mongo`).

```bash
# API
cd backend
cp .env.example .env        # ajuste MONGODB_URI si es necesario
npm install
npm run start:dev           # http://localhost:3000/api

# Web (en otra terminal)
cd frontend
npm install
npm start                   # http://localhost:4200 (redirige /api al backend)
```

### Usuario inicial

Al iniciar por primera vez se crea el administrador definido en `.env`:

- Correo: `admin@qa.local`
- Contraseña: `Admin123!` (cámbiela desde el menú de usuario)

Primeros pasos: cree un **proyecto** y sus **módulos/flujos** en *Proyectos y módulos*. Luego registre información
de forma individual o descargue una plantilla en *Carga masiva*.

## Roles y permisos

Los permisos se asignan por rol y por módulo (Ver, Crear, Editar, Eliminar, Carga masiva) y el administrador los
puede cambiar en *Permisos por rol*. Valores iniciales:

| Módulo | Analista QA | Líder QA | Administrador |
|---|---|---|---|
| Base de conocimiento | Ver, crear, editar, carga masiva | Todo | Todo |
| Catálogos (proyectos/módulos) | Ver | Todo | Todo |
| Generación de casos *(próximamente)* | Ver, crear | Todo | Todo |
| Administración (usuarios y permisos) | — | — | Todo (no se puede quitar) |

## Carga masiva

El formato de los archivos está descrito en [docs/formato-carga-masiva.md](docs/formato-carga-masiva.md).
El flujo es el siguiente:

1. El usuario elige el proyecto y el módulo predeterminado.
2. Adjunta uno o más archivos `.xlsx`, `.docx` o `.csv` (hasta 10 archivos de 10 MB por carga).
3. El sistema crea un **lote en revisión** y valida cada fila: campos obligatorios, valores permitidos, fechas,
   módulo, referencias temporales repetidas y relaciones entre registros.
4. El usuario revisa las filas, corrige las que tienen errores (en un formulario) y excluye las que no quiera cargar.
5. Al confirmar, el sistema asigna los códigos definitivos, traduce las referencias temporales a esos códigos y guarda
   los registros con su origen (archivo y lote). Las advertencias no impiden guardar; los errores sí.

## Pruebas

```bash
cd backend && npm test
```

Incluyen la validación de registros y una prueba de ida y vuelta: se genera cada plantilla (Excel, Word y CSV), se
vuelve a leer y se verifica que todos los ejemplos sean válidos.
