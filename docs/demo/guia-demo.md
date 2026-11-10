# Guía de demostración y pruebas

Archivos:

- `demo-historico-tienda-galaxia.xlsx`: información histórica válida (46 registros).
- `demo-carga-con-errores.xlsx`: 7 registros, 5 de ellos con errores intencionales.

## 1. Catálogos a registrar (Configuración › Proyectos y módulos)

**Proyecto:** `Tienda Galaxia Online`

| Módulo / flujo | Descripción |
|---|---|
| Compra de monedas virtuales | Selección del paquete de gemas, compra y acreditación al saldo del jugador |
| Pasarela de pago | Pago con tarjeta o billetera digital, pagos pendientes, rechazos y reembolsos |
| Promociones y bonificaciones | Bonificaciones y beneficios asociados a las compras |
| Control parental | Límites de compra para cuentas de menores de edad |

Los nombres deben escribirse exactamente así: la columna **Módulo** del Excel se compara con ellos.

## 2. Carga masiva del histórico

1. **Carga masiva** › proyecto *Tienda Galaxia Online*, módulo por defecto *Compra de monedas virtuales*.
2. Subir `demo-historico-tienda-galaxia.xlsx`. Resultado esperado: **46 válidos, 0 errores**.

   | Hoja | Registros | Códigos tras confirmar |
   |---|---|---|
   | Requerimientos | 8 | REQ-001 a REQ-008 |
   | HistoriasUsuario | 9 | HU-001 a HU-009 |
   | ReglasNegocio | 12 | RN-001 a RN-012 |
   | CasosPrueba (+ PasosCasoPrueba) | 12 (5 fallidos) | CP-001 a CP-012 |
   | Defectos | 5 | DEF-001 a DEF-005 |

3. Confirmar. En una base con registros previos, los códigos continúan la numeración existente.

## 3. Carga con errores (revisión y corrección)

Subir `demo-carga-con-errores.xlsx`. Resultado esperado: **2 válidas, 5 con errores**. El botón Confirmar queda
deshabilitado hasta corregirlas o excluirlas.

| Fila | Error | Corrección |
|---|---|---|
| REQ2 | Prioridad "Urgente" | Alta |
| RN1 | Módulo "Tienda de regalos" no existe | Elegir *Compra de monedas virtuales* |
| RN2 | Regla sin nombre | Escribir "Historial de 90 días" |
| HU2 | Sin rol y puntos de historia "4" | Rol "Jugador" y puntos 5 |
| CP1 | Tipo de escenario "Valor límite" (ya no existe) | Positivo (la técnica sigue siendo Análisis de valores límite) |

Corregir una o dos filas para mostrar el cambio de estado y **cancelar el lote**, para no mezclar estos registros con
la demo.

## 4. Base de conocimiento

- **Historias de usuario › HU-006**: ver su requerimiento (REQ-005) y su regla (RN-005).
- **Casos de prueba › CP-008**: está vinculado a REQ-005, HU-006, RN-005 y DEF-001 (trazabilidad completa).
- Buscar por texto (p. ej. "límite") y filtrar por módulo.
- Registrar una historia nueva por formulario y comprobar que recibe el código HU-010.

## 5. Generación de casos de prueba

| # | Punto de partida | Parámetros | Qué mostrar |
|---|---|---|---|
| 1 | Módulo *Compra de monedas virtuales* › **Requerimiento registrado** REQ-001 | Los 4 tipos de escenario, 8 casos | Contexto directo al 100 %: HU-001, HU-002, RN-001, RN-002, RN-006, RN-012, CP-001 a CP-003 y DEF-002. Casos sobre pago duplicado (DEF-002), montos mínimo y máximo (RN-006) y bloqueo por intentos (RN-012). |
| 2 | Módulo *Control parental* › **Historia de usuario registrada** HU-006 | Positivo y Negativo, técnica *Análisis de valores límite*, 5 casos | Trazabilidad requerimiento → historia → regla → caso → defecto: entran REQ-005, RN-005, CP-008, CP-009 y DEF-001. Casos de borde: 50.00 USD aceptado (positivo) y 50.01 USD rechazado (negativo). |
| 3 | Módulo *Pasarela de pago* › REQ-003 *Pago con billetera digital* | Solo Alternativo y Excepción, 4 casos | Los parámetros cambian el resultado: caminos válidos distintos al principal y fallas del entorno (servicio que no responde, notificación duplicada). |
| 4 | **Nuevo requerimiento (texto libre)**: "Compra de gemas con cupón de descuento". Descripción: "El jugador puede aplicar un cupón de descuento vigente al comprar un paquete de gemas." | Por defecto | La recuperación por similitud funciona sin relaciones registradas. En **Observaciones**, el modelo indica que faltan reglas sobre cupones. |

En cada escenario conviene enseñar:

- la tabla de contexto (quitar un registro y agregar otro con el buscador);
- el diálogo de progreso;
- el detalle: casos con pasos, tipo de escenario, técnica, fuentes, contexto usado, tokens y tiempo;
- la lista **Mis generaciones**.
