# Formato de archivos para la carga masiva (propuesta v1)

Las plantillas con ejemplos se descargan desde **Carga masiva → Plantillas**. Este documento describe las reglas
que sigue el sistema al leerlas.

## Reglas generales

- El **proyecto** se elige al cargar. La columna **Módulo** es opcional; si se deja vacía, se usa el módulo
  predeterminado del lote. Si indica un módulo que no existe en el catálogo, la fila queda con error hasta que se
  corrija.
- Los **códigos** identifican cada registro y son únicos dentro del proyecto. Se guardan en mayúsculas y sin
  espacios. Se sugieren los prefijos `REQ-`, `RN-`, `CP-` y `DEF-`.
- Las **relaciones** se indican con códigos. Si son varios, se separan con `;` (por ejemplo, `REQ-001;REQ-002`). Si un
  código no existe ni en el proyecto ni en el lote, se muestra una advertencia, pero el registro se puede guardar.
- En las **listas** (criterios de aceptación) los valores se separan con `;` o con saltos de línea.
- Las **fechas** se escriben como `AAAA-MM-DD` o `DD/MM/AAAA`. También se aceptan celdas de fecha de Excel.
- Los **valores de lista cerrada** no distinguen mayúsculas ni tildes (`validacion` se reconoce como `Validación`).
- Los encabezados se reconocen sin importar mayúsculas, tildes ni el `*` de obligatorio. Las columnas desconocidas
  se ignoran y se informan.

## Campos por tipo

\* = obligatorio

### Requerimientos (hoja `Requerimientos`)
| Columna | Tipo | Valores |
|---|---|---|
| Código * | texto | p. ej. REQ-001 |
| Módulo | texto | nombre del módulo/flujo |
| Título * | texto | |
| Descripción * | texto largo | |
| Tipo | lista | Funcional, No funcional |
| Prioridad | lista | Alta, Media, Baja |
| Criterios de aceptación | lista | separados por `;` |
| Versión | texto | |
| Fecha | fecha | |
| Fuente | texto | documento, historia de usuario o ticket |

### Reglas de negocio (hoja `ReglasNegocio`)
| Columna | Tipo | Valores |
|---|---|---|
| Código * | texto | p. ej. RN-001 |
| Módulo | texto | |
| Nombre * | texto | |
| Descripción * | texto largo | |
| Tipo | lista | Validación, Cálculo, Restricción, Flujo, Autorización |
| Condición | texto largo | "Si…" |
| Acción / Resultado | texto largo | "Entonces…" |
| Excepciones | texto largo | |
| Criticidad | lista | Alta, Media, Baja |
| Requerimientos relacionados | códigos | REQ-001;REQ-002 |

### Casos de prueba (hoja `CasosPrueba`)
| Columna | Tipo | Valores |
|---|---|---|
| Código * | texto | p. ej. CP-001 |
| Módulo | texto | |
| Título * | texto | |
| Requerimiento * | código | REQ-001 |
| Reglas de negocio | códigos | RN-001;RN-003 |
| Tipo de escenario * | lista | Positivo, Negativo, Valor límite, Excepción |
| Técnica de diseño | lista | Partición de equivalencia, Análisis de valores límite, Tabla de decisión, Transición de estados, Casos de uso, Conjetura de errores, Otra |
| Prioridad | lista | Alta, Media, Baja |
| Precondiciones | texto largo | |
| Datos de prueba | texto largo | |
| Resultado esperado * | texto largo | |
| Resultado obtenido | texto largo | |
| Estado de ejecución * | lista | Exitoso, Fallido, Bloqueado, No ejecutado |
| Fecha de ejecución | fecha | |
| Ejecutado por | texto | |
| Defecto asociado | código | DEF-001 |

**Pasos** (obligatorio, al menos uno). Van en la hoja `PasosCasoPrueba`:

| Código caso * | N° paso * | Acción * | Resultado esperado * |
|---|---|---|---|
| CP-001 | 1 | Ingresar a la tienda del juego | Se listan los paquetes de gemas |

Los pasos se ordenan por su número y se enlazan con el caso por su código. El caso puede estar en otro archivo del
mismo lote.

### Defectos (hoja `Defectos`)
| Columna | Tipo | Valores |
|---|---|---|
| Código * | texto | p. ej. DEF-001 |
| Módulo | texto | |
| Título * | texto | |
| Descripción * | texto largo | |
| Pasos para reproducir | texto largo | |
| Severidad * | lista | Crítica, Alta, Media, Baja |
| Estado * | lista | Abierto, En progreso, Resuelto, Cerrado, Rechazado |
| Caso de prueba | código | CP-002 |
| Requerimiento | código | REQ-002 |
| Fecha de reporte | fecha | |
| Reportado por | texto | |

## Particularidades por formato

### Excel (.xlsx)
Un libro con una hoja por tipo: `Requerimientos`, `ReglasNegocio`, `CasosPrueba`, `PasosCasoPrueba` y `Defectos`.
La hoja `Instrucciones` se ignora. La primera fila es el encabezado. Las columnas de lista cerrada tienen menús
desplegables.

### CSV (.csv)
Un archivo por tipo, con las mismas columnas que la hoja de Excel. El tipo se reconoce por el nombre del archivo
(por ejemplo, `CasosPrueba.csv` o `casos_prueba_2024.csv`) o, si no coincide, por sus encabezados. El archivo debe
estar en UTF-8 (también se acepta el formato que guarda Excel en Windows) y puede usar `;`, `,` o tabulación como
separador.

### Word (.docx)
Cada registro es una **tabla de dos columnas** (*Campo | Valor*):

| Tipo | Caso de prueba |
|---|---|
| Código * | CP-001 |
| Título * | Compra exitosa de paquete de 500 gemas |
| … | … |

La primera fila indica el tipo: `Requerimiento`, `Regla de negocio`, `Caso de prueba` o `Defecto`. Los pasos de un
caso van en una tabla **inmediatamente después** de la suya:

| N° paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Ingresar a la tienda del juego | Se listan los paquetes |

En los campos de lista se escribe un valor por línea. El resto del documento (títulos, instrucciones) se ignora.
