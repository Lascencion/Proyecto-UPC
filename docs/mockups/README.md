# Mockups de pantallas (Balsamiq)

Mockups de todas las pantallas del sistema: las implementadas en la iteración 1 (01–18, base de conocimiento y
administración) y las de los flujos de las próximas iteraciones (19–31: generación con LLM, revisión, aprobación,
exportación y reportes; historias HU-04 a HU-12).

- **`QA-Knowledge.bmpr`**: proyecto de Balsamiq Wireframes con las 31 pantallas. Se abre con
  *Balsamiq Wireframes 4* (Archivo → Abrir) o se importa en *Balsamiq Cloud* (Import → Balsamiq project).
  Todos los elementos son controles nativos y se pueden editar.
- **`png/`**: vista previa de cada pantalla para insertar en los documentos de la tesis.

| N.° | Pantalla | Ruta en el sistema |
|---|---|---|
| 01 | Inicio de sesión | `/login` |
| 02 | Inicio (resumen de la base de conocimiento y acciones rápidas) | `/inicio` |
| 03 | Menú de usuario | barra superior |
| 04 | Cambiar contraseña | diálogo |
| 05 | Base de conocimiento: listado con pestañas, búsqueda y filtros | `/conocimiento/:tipo` |
| 06 | Eliminar registro (confirmación) | diálogo |
| 07 | Registrar requerimiento | `/conocimiento/requirements/nuevo` |
| 08 | Registrar caso de prueba (con pasos) | `/conocimiento/test-cases/nuevo` |
| 09 | Selección de registros relacionados (lista con buscador) | campo del formulario |
| 10 | Revisar y editar registro (con datos de origen y auditoría) | `/conocimiento/:tipo/:id` |
| 11 | Carga masiva: destino, archivos, plantillas y cargas recientes | `/carga-masiva` |
| 12 | Revisión de la carga masiva (estado por fila) | `/carga-masiva/:id` |
| 13 | Corregir fila de la carga | diálogo |
| 14 | Proyectos y módulos | `/catalogos` |
| 15 | Nuevo módulo | diálogo |
| 16 | Usuarios | `/admin/usuarios` |
| 17 | Editar usuario | diálogo |
| 18 | Permisos por rol | `/admin/permisos` |

**Próximas iteraciones** (menú según el rol: Analista QA o Líder QA)

| N.° | Pantalla | Historia | Rol |
|---|---|---|---|
| 19 | Mis generaciones (solicitudes y su estado) | HU-05 | Analista QA |
| 20 | Generar casos: requerimiento, información histórica relacionada y parámetros | HU-04, HU-05 | Analista QA |
| 21 | Generación en curso | HU-05 | Analista QA |
| 22 | Casos generados (versión, estado de revisión por caso) | HU-05, HU-06 | Analista QA |
| 23 | Revisar caso generado (edición, trazabilidad y observaciones) | HU-06 | Analista QA |
| 24 | Regenerar con observaciones (nueva versión) | HU-07 | Analista QA |
| 25 | Enviar a aprobación | HU-08 | Analista QA |
| 26 | Bandeja de aprobaciones | HU-09 | Líder QA |
| 27 | Aprobación de casos (aprobar u observar cada caso) | HU-09 | Líder QA |
| 28 | Devolver con observaciones | HU-09 | Líder QA |
| 29 | Exportar casos aprobados y registrarlos en la base de conocimiento | HU-10 | Analista QA |
| 30 | Reportes del proceso | HU-11 | Líder QA |
| 31 | Reporte de cobertura (manual frente a LLM) | HU-12 | Líder QA |

Los datos de ejemplo usan el caso de estudio (compra de monedas virtuales en la tienda de un videojuego).

## Regenerar

Las pantallas se describen en `herramientas/generar_mockups.py`; de ahí salen el `.bmpr` y las vistas previas.

```bash
cd docs/mockups/herramientas
python3 generar_mockups.py html /tmp/mockups-html <assets>   # <assets>: Balsamiq Sans (bs400/bs700.woff2) y font-awesome 4.7 en fa/package
node render.mjs /tmp/mockups-html ../png /tmp/mockups-thumbs   # requiere Playwright
python3 generar_mockups.py bmpr ../QA-Knowledge.bmpr /tmp/mockups-thumbs
```
