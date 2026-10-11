# Mockups de pantallas (Balsamiq)

Mockups de las pantallas implementadas en la iteración 1 (Módulo 1: base de conocimiento).

- **`QA-Knowledge.bmpr`**: proyecto de Balsamiq Wireframes con las 18 pantallas. Se abre con
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

Los datos de ejemplo usan el caso de estudio (compra de monedas virtuales en la tienda de un videojuego).

## Regenerar

Las pantallas se describen en `herramientas/generar_mockups.py`; de ahí salen el `.bmpr` y las vistas previas.

```bash
cd docs/mockups/herramientas
python3 generar_mockups.py html /tmp/mockups-html <assets>   # <assets>: Balsamiq Sans (bs400/bs700.woff2) y font-awesome 4.7 en fa/package
node render.mjs /tmp/mockups-html ../png /tmp/mockups-thumbs   # requiere Playwright
python3 generar_mockups.py bmpr ../QA-Knowledge.bmpr /tmp/mockups-thumbs
```
