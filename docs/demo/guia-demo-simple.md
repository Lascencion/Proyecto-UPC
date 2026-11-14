# Guía de demo simple: compra de monedas en Videojuego Nexa Legends

Archivo: `demo-nexa-simple.xlsx` (15 registros).

## La historia en una frase

> El equipo QA probó la compra de monedas solo con **2 casos positivos** (el "camino feliz"). Por eso un
> **defecto llegó a producción**: un jugador recibió sus monedas **dos veces**. Con el sistema, el LLM lee el
> requerimiento, sus reglas y ese defecto, y genera los casos **negativos, alternativos y de excepción** que faltaban.

## 1. Preparación

En **Configuración › Proyectos y módulos**:

| Catálogo | Valor (escribirlo exactamente así) |
|---|---|
| Proyecto | `Videojuego Nexa Legends` |
| Módulo / flujo | `Compra de monedas virtuales` |

Para generar casos reales, configure `ANTHROPIC_API_KEY` en `backend/.env` (sin la clave el sistema responde en modo
simulado, con casos de ejemplo).

## 2. Carga masiva

**Carga masiva** › proyecto *Videojuego Nexa Legends*, módulo *Compra de monedas virtuales* › subir
`demo-nexa-simple.xlsx`. Resultado esperado: **15 válidos, 0 errores**. Confirmar.

| Tipo | Registros | Qué son |
|---|---|---|
| Requerimientos | REQ-001, REQ-002 | **REQ-001 Compra de paquete de monedas** (el de la demo) y REQ-002 Bonificación del paquete Intermedio |
| Historias de usuario | HU-001, HU-002 | Una por requerimiento |
| Reglas de negocio | RN-001 a RN-006 | Precios, métodos de pago, acreditar solo con pago aprobado, no acreditar dos veces, máximo 5 compras por día, bonificación |
| Casos de prueba | CP-001 a CP-003 | Solo positivos (el proceso manual) |
| Defectos | DEF-001, DEF-002 | **DEF-002: monedas acreditadas dos veces en producción** (ningún caso lo cubría) |

Datos del caso: paquetes Básico (500 monedas, 18.90 PEN / 4.99 USD), Intermedio (1 200, 37.90 PEN / 9.99 USD) y
Premium (2 500, 74.90 PEN / 19.99 USD); pago con tarjeta o PayPal.

## 3. Mostrar el problema (1 minuto)

**Base de conocimiento › Requerimientos › REQ-001 › Ver trazabilidad**:

- 5 reglas de negocio (RN-001 a RN-005);
- solo 2 casos de prueba, ambos **Positivos** (CP-001 y CP-002);
- el defecto **DEF-002** (Crítica): sucedió en producción porque nadie probó la regla RN-004.

Mensaje: *"Con el proceso manual se probó solo el camino feliz; las reglas RN-004 y RN-005 no tienen ningún caso."*

## 4. Generar los casos (2 minutos)

**Generación › Generar casos**:

1. **Requerimiento a validar:** proyecto y módulo de la demo › *Requerimiento registrado* › **REQ-001**.
2. **Recuperar información relacionada:** el sistema trae HU-001, RN-001 a RN-005, CP-001, CP-002 y DEF-002
   como relación directa; por similitud de texto puede sugerir además algún registro de REQ-002 (se puede quitar).
   Explicar: *"Esto es lo que el LLM va a leer"*.
3. **Parámetros:** los 4 tipos de escenario marcados; técnicas *Partición de equivalencia* y *Análisis de valores
   límite*; cantidad máxima **8**.
4. **Generar casos.**

Casos que se esperan (el texto exacto lo redacta el modelo):

| Tipo | Ejemplo | Regla |
|---|---|---|
| Positivo | Compra del paquete Intermedio en USD con tarjeta | RN-001, RN-003 |
| Positivo (límite) | La quinta compra del día se permite | RN-005 |
| Negativo (límite) | La sexta compra del día se bloquea | RN-005 |
| Negativo | Tarjeta rechazada: no se acreditan monedas | RN-003 |
| Alternativo | El jugador cancela en el resumen o cierra PayPal sin autorizar | RN-003 |
| Excepción | La pasarela envía dos veces la confirmación: se acredita una sola vez | RN-004 (DEF-002) |

## 5. Mostrar el resultado (1 minuto)

| | Proceso actual (manual) | Sistema con LLM |
|---|---|---|
| Casos para REQ-001 | 2 | hasta 8 |
| Tipos de escenario cubiertos | 1 de 4 (solo Positivo) = 25 % | 4 de 4 = 100 % |
| Reglas de negocio cubiertas | 3 de 5 (RN-001 a RN-003) = 60 % | 5 de 5 = 100 % |

Indicador IE4, con los tipos de escenario: **MC = (100 − 25) / 25 × 100 = 300 %** (meta: ≥ 20 %).

Los porcentajes del sistema dependen de los casos que genere el modelo: confírmelos con el resultado real antes
de presentarlos.
