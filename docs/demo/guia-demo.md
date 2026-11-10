# Guía de demostración – Generación de casos de prueba

## 1. Catálogos a registrar (Administración › Catálogos)

**Proyecto:** `Tienda Galaxia Online`, el juego en línea de Nexa Games Studios con una tienda de gemas.

| Módulo / flujo | Descripción |
|---|---|
| Compra de monedas virtuales | Selección del paquete de gemas, compra y acreditación al saldo del jugador |
| Pasarela de pago | Pago con tarjeta o billetera digital, pagos pendientes, rechazos y reembolsos |
| Promociones y bonificaciones | Bonificaciones y beneficios asociados a las compras |
| Control parental | Límites de compra para cuentas de menores de edad |

Los nombres deben escribirse exactamente así, porque la columna **Módulo** del Excel se compara con ellos.

## 2. Carga del histórico

1. Ir a **Carga masiva** y elegir el proyecto *Tienda Galaxia Online* con el módulo por defecto *Compra de monedas virtuales*.
2. Subir `demo-historico-tienda-galaxia.xlsx`. El resultado esperado son **46 registros válidos, 0 errores**:
   - 8 requerimientos
   - 9 historias de usuario (HU1–HU9, vinculadas a requerimientos, reglas, casos y defectos)
   - 12 reglas de negocio
   - 12 casos ejecutados con sus pasos (5 fallidos)
   - 5 defectos
3. Confirmar. Las referencias REQ1, HU1, RN1… se convierten en códigos REQ-001, HU-001, RN-001…

En una base con registros previos, los códigos continúan la numeración existente. En ese caso, busque los registros por título.

**Opcional, para mostrar la corrección (HU05/HU06):** subir `demo-carga-con-errores.xlsx`. Muestra 3 filas con error:

| Error | Corrección |
|---|---|
| Prioridad "Urgente" | Corregirla a Alta |
| Módulo "Tienda de regalos", que no existe | Elegir otro módulo |
| Regla sin nombre | Escribir un nombre |

Después de corregir las filas se puede confirmar, o cancelar el lote.

## 3. Escenarios de generación (Generar casos)

| # | Requerimiento | Parámetros | Qué mostrar |
|---|---|---|---|
| 1 | REQ-001 *Compra de paquete de gemas con tarjeta* (módulo Compra de monedas virtuales) | Todos los tipos de escenario, 8 casos | Contexto recuperado: relacionados directos al 100 % (RN-001, RN-002, RN-006, RN-012, CP-001 a CP-003, DEF-002) más similares por texto. Los casos cubren pago duplicado (DEF-002), montos límite (RN-006) y bloqueo por intentos (RN-012). |
| 2 | Nuevo requerimiento (texto libre): *Compra de gemas con cupón de descuento*. Descripción: "El jugador puede aplicar un cupón de descuento vigente al comprar un paquete de gemas." | Por defecto | La recuperación funciona por similitud aun sin relaciones registradas. En **Observaciones**, el modelo indica que no hay reglas de cupones en la base. |
| 3 | REQ-005 *Límite diario de compra para menores de edad* (módulo Control parental) | Solo *Positivo* y *Negativo*, técnica *Análisis de valores límite*, 5 casos | Casos de borde (límite exacto, aceptado; superado por centavos, rechazado) influenciados por DEF-001 y CP-008. |

En cada escenario conviene enseñar:

- la tabla de contexto, donde se puede quitar o agregar un registro con el buscador;
- el diálogo de progreso;
- el detalle de la generación (casos con pasos, trazabilidad hacia el contexto usado, tokens y tiempo);
- la lista **Mis generaciones**.

### Escenario adicional: generación desde una historia de usuario

En **Generar casos**, elegir el módulo *Control parental*, marcar **Historia de usuario registrada** y seleccionar
**HU-006** *Limitar las compras diarias de un menor*. El contexto incluye como relación directa (100 %) su
requerimiento REQ-005, la regla RN-005, los casos CP-008 y CP-009 y el defecto DEF-001. Esto muestra la trazabilidad
requerimiento → historia → regla → caso → defecto.
