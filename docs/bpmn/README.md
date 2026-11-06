# Diagramas BPMN 2.0

| Archivo | Proceso | Carriles |
|---|---|---|
| `AS-IS_generacion_casos_prueba.bpmn` | Proceso actual: generación manual de casos de prueba para la compra de monedas virtuales | Equipo de Producto, Analista QA, Líder QA |
| `TO-BE_generacion_casos_prueba_LLM.bpmn` | Proceso propuesto: generación de casos de prueba con LLM | Analista QA, Sistema (LLM), Líder QA |
| `Flujo_compra_monedas_virtuales.bpmn` | Flujo de compra de monedas virtuales en el videojuego (caso de estudio) | Jugador, Sistema (videojuego) |

Archivos BPMN 2.0 estándar (modelo + diagrama BPMNDI), con un pool y un carril por rol.

## Abrir en Bizagi Modeler

1. Bizagi Modeler → menú **Archivo → Importar → BPMN** (en versiones antiguas: *Importar desde → BPMN 2.0*).
2. Elegir el archivo `.bpmn`. Se crea un diagrama editable con pools, carriles, tareas, compuertas y flujos.
3. Guardar como `.bpm` para seguir trabajándolo en Bizagi.

También se abren en bpmn.io, Camunda Modeler y otras herramientas BPMN 2.0.

## Notación usada

- **AS-IS**: tareas manuales (todo el trabajo es manual). El punto crítico va como anotación asociada a
  "Identificar escenarios manualmente". "Corregir casos de prueba" está en el carril del Analista QA, que es quien corrige.
- **TO-BE**: tareas de usuario para el Analista QA y el Líder QA, y tareas de servicio para el sistema.
  Cada tarea lleva su descripción en *Documentación*.
- `png/`: vista previa de cada diagrama, con los colores por defecto de Bizagi (inicio verde, fin rojo, tareas celestes y compuertas amarillas).
- `herramientas/generar_bpmn.py`: genera los archivos (`python3 herramientas/generar_bpmn.py .` desde esta carpeta).
