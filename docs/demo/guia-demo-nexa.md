# Guía de demo: Nexa Games Studios (variables de la tesis)

Archivo: `demo-nexa-compra-monedas.xlsx`. Contiene el histórico del caso de estudio de la tesis, armado con las
cinco variables de la **Tabla 5** (5 × 4 × 3 × 4 × 5 = 1 200 combinaciones):

| Variable | Valores usados en el archivo |
|---|---|
| Métodos de pago (5) | Tarjeta de crédito o débito, PayPal, transferencia interbancaria, pago en efectivo, criptomonedas |
| Tipos de promoción (4) | Sin promoción, descuento porcentual (20 % en Premium), bonificación (+120 monedas en Intermedio), tiempo limitado (x2 en Básico, del 1 al 7 de setiembre) |
| Paquetes (3) | Básico 500, Intermedio 1 200, Premium 2 500 monedas |
| Monedas de cobro (4) | PEN, USD, EUR, BRL (precio de tabla por moneda, RN1) |
| Estados de transacción (5) | Aprobada, Rechazada, Pendiente, Cancelada, Reembolsada |

Además incluye las condiciones adicionales que menciona la tesis: compatibilidad entre moneda y método de pago (RN2),
cuenta verificada (RN12), límite diario de 150.00 USD (RN11), vigencia del paquete (RN14), monto mínimo y cotización
de las criptomonedas (RN10), vencimiento de pagos pendientes (RN5), promociones no acumulables (RN9) y bloqueo por
rechazos (RN15).

## 1. Preparación (Configuración › Proyectos y módulos)

| Catálogo | Valor (escribirlo exactamente así) |
|---|---|
| Proyecto | `Videojuego Nexa Legends` |
| Módulo / flujo | `Compra de monedas virtuales` |

Descripción sugerida del módulo: *Flujo de compra de monedas virtuales: catálogo de paquetes, moneda de cobro,
métodos de pago, promociones, registro de la transacción, acreditación y reembolsos.*

Todos los registros del Excel pertenecen a ese único módulo. Las partes del flujo (catálogo, métodos de pago,
promociones, transacciones y acreditación) no son módulos del sistema: están dentro del contenido de los
requerimientos, historias, reglas y casos.

Si no tiene clave de Anthropic, el sistema genera en **modo simulado**. Para la demo con la profesora conviene
configurar `ANTHROPIC_API_KEY` en `backend/.env`, porque así los casos se generan de verdad a partir del contexto.

## 2. Carga masiva

1. **Carga masiva** › proyecto *Videojuego Nexa Legends*, módulo por defecto *Compra de monedas virtuales*.
2. Subir `demo-nexa-compra-monedas.xlsx`. Resultado esperado: **56 válidos, 0 errores**.

   | Hoja | Registros | Códigos tras confirmar |
   |---|---|---|
   | Requerimientos | 10 | REQ-001 a REQ-010 |
   | HistoriasUsuario | 10 | HU-001 a HU-010 |
   | ReglasNegocio | 15 | RN-001 a RN-015 |
   | CasosPrueba (+ 46 pasos) | 16 (5 fallidos) | CP-001 a CP-016 |
   | Defectos | 5 | DEF-001 a DEF-005 |

3. Mostrar la pantalla de revisión (filtros por estado y tipo) y **Confirmar**.

## 3. El mensaje de la demo: el histórico manual tiene huecos

Los 16 casos históricos imitan el proceso actual (AS-IS): **10 positivos, 3 negativos, 2 alternativos y
1 de excepción**. Hay reglas registradas que **ningún caso cubre**:

| Regla sin casos | Escenario que falta |
|---|---|
| RN9 Promociones no acumulables | Paquete con dos promociones vigentes |
| RN10 Cripto: mínimo 9.99 USD y cotización de 15 min | Paquete Básico (4.99 USD) con cripto; cotización vencida |
| RN11 Límite diario (solo se probó el valor exacto) | 150.01 USD: compra rechazada |
| RN12 Cuenta verificada | Jugador sin correo verificado |
| RN14 Vigencia del paquete | Paquete desactivado mientras el jugador está en la tienda |
| RN15 Bloqueo por rechazos | Tercer rechazo seguido con tarjeta |
| RN13 (excepción) | Reembolso fuera de plazo o con saldo insuficiente |

Esto ilustra la causa principal del Pareto (Tabla 6): escenarios no contemplados por la combinación de variables.

## 4. Generación de casos de prueba

| # | Punto de partida (módulo *Compra de monedas virtuales*) | Parámetros | Qué mostrar |
|---|---|---|---|
| 1 | REQ-006 *Pago con criptomonedas* | 4 tipos de escenario; técnicas *Análisis de valores límite* y *Conjetura de errores*; 6 casos | El histórico solo tiene 1 caso positivo (CP-010). El LLM agrega Básico 4.99 USD rechazado, Intermedio 9.99 USD aceptado (límite), moneda PEN sin opción cripto y cotización vencida. |
| 2 | REQ-007 *Aplicación de promociones* | 4 tipos; técnica *Tabla de decisión*; 8 casos | Contexto: HU-007, RN-006 a RN-009, CP-003, CP-004, CP-009 y DEF-001/DEF-003. Debe aparecer el caso de promociones no acumulables (RN-009) y casos de regresión de los defectos. |
| 3 | HU-009 *Respetar el límite diario* | Positivo y Negativo; *Análisis de valores límite*; 4 casos | 150.00 USD aceptado y 150.01 USD rechazado; cuenta sin verificar (RN-012). |
| 4 | REQ-008 *Registro de la transacción* | 4 tipos; *Transición de estados*; 8 casos | Recorre los 5 estados: Pendiente → Aprobada, Pendiente → Cancelada, Aprobada → Reembolsada, Rechazada sin acreditación y notificación duplicada (DEF-002). |
| 5 | **Requerimiento nuevo (texto libre)** › título "Pago con billetera móvil Yape", descripción "El jugador puede pagar paquetes de monedas en PEN con la billetera móvil Yape escaneando un código QR." | Por defecto | No tiene relaciones, pero la similitud TF-IDF recupera RN-002, RN-003, RN-005 y los casos de pago. En **Observaciones** el modelo debería advertir que falta una regla de compatibilidad para Yape. |

En cada generación conviene enseñar: la tabla de contexto (quitar y agregar un registro), el progreso, el detalle de
cada caso (tipo, técnica, precondiciones, datos, pasos, resultado esperado y fuentes) y **Mis generaciones**.

## 5. Relación con el indicador IE4

Para cada requerimiento de la demo se puede contar la cobertura de tipos de escenario:

- **CA** (proceso actual): tipos o reglas cubiertos por los casos históricos del requerimiento.
- **CS** (sistema): tipos o reglas cubiertos por los casos generados.
- **MC = (CS − CA) / CA × 100**, con meta MC ≥ 20 %.

Ejemplo con REQ-006: el histórico cubre 1 de 4 tipos de escenario (solo Positivo). Si la generación cubre los 4,
MC = (4 − 1) / 1 × 100 = 300 %. Es una ilustración para la demo; la validación formal del capítulo 5 debe usar el
conjunto de escenarios esperados que se defina allí.
