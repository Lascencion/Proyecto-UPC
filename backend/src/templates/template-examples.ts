import { EntityType } from '../knowledge/definitions/entity-definitions';

/**
 * Ejemplos que acompañan a las plantillas. Corresponden al flujo de compra de
 * monedas virtuales en un videojuego en línea, pero el formato es genérico.
 * `code` es la referencia temporal del archivo (REQ1, RN1…): el sistema asigna
 * el código definitivo al confirmar la carga.
 */
export const EXAMPLE_MODULE = 'Compra de monedas virtuales';

export const TEMPLATE_EXAMPLES: Record<EntityType, Record<string, unknown>[]> = {
  requirements: [
    {
      code: 'REQ1',
      title: 'Compra de paquete de gemas con tarjeta',
      description:
        'Como jugador quiero comprar paquetes de gemas desde la tienda del juego pagando con tarjeta de crédito o débito para usarlas en artículos del juego.',
      priority: 'Alta',
      acceptanceCriteria: [
        'Se muestran los paquetes disponibles con su precio en moneda local',
        'Las gemas se acreditan al saldo solo cuando el pago es aprobado',
        'Se envía el comprobante de compra al correo del jugador',
      ],
      version: '1.0',
      date: '2025-03-10',
      source: 'HU-125',
    },
    {
      code: 'REQ2',
      title: 'Límite diario de compra para cuentas de menores de edad',
      description:
        'El sistema debe limitar el monto diario de compras de monedas virtuales en cuentas de jugadores menores de 18 años.',
      priority: 'Alta',
      acceptanceCriteria: [
        'El límite diario para menores es de 50 USD',
        'Al superar el límite se rechaza la compra con un mensaje claro',
      ],
      version: '1.0',
      date: '2025-03-12',
      source: 'HU-131',
    },
  ],
  'business-rules': [
    {
      code: 'RN1',
      name: 'Acreditación solo con pago aprobado',
      description: 'Las gemas compradas se acreditan al saldo del jugador únicamente cuando la pasarela confirma el pago.',
      type: 'Flujo',
      condition: 'Si la pasarela de pago devuelve el estado APROBADO',
      action: 'Acreditar al saldo del jugador la cantidad de gemas del paquete comprado',
      exceptions: 'Si el estado es PENDIENTE, las gemas se acreditan al recibir la confirmación (máximo 24 horas)',
      criticality: 'Alta',
      relatedRequirements: ['REQ1'],
    },
    {
      code: 'RN2',
      name: 'Límite diario para menores de edad',
      description: 'Una cuenta de menor de edad no puede superar 50 USD en compras por día calendario.',
      type: 'Validación',
      condition: 'Si la cuenta pertenece a un menor de 18 años y el monto acumulado del día más la compra supera 50 USD',
      action: 'Rechazar la compra y mostrar el mensaje "Alcanzaste el límite diario de compras"',
      exceptions: '',
      criticality: 'Alta',
      relatedRequirements: ['REQ2'],
    },
    {
      code: 'RN3',
      name: 'Transacción no duplicada',
      description: 'Una misma transacción de pago no debe acreditar gemas más de una vez.',
      type: 'Restricción',
      condition: 'Si la pasarela notifica más de una vez el mismo identificador de transacción',
      action: 'Acreditar las gemas una sola vez e ignorar las notificaciones repetidas',
      exceptions: '',
      criticality: 'Alta',
      relatedRequirements: ['REQ1'],
    },
  ],
  'test-cases': [
    {
      code: 'CP1',
      title: 'Compra exitosa de paquete de 500 gemas con tarjeta válida',
      requirements: ['REQ1'],
      relatedRules: ['RN1'],
      scenarioType: 'Positivo',
      designTechnique: 'Partición de equivalencia',
      priority: 'Alta',
      preconditions: 'Jugador autenticado, mayor de edad, con saldo inicial de 0 gemas',
      testData: 'Tarjeta VISA de prueba 4111 1111 1111 1111; paquete de 500 gemas (4.99 USD)',
      steps: [
        { number: 1, action: 'Ingresar a la tienda del juego', expectedResult: 'Se listan los paquetes de gemas con su precio' },
        { number: 2, action: 'Seleccionar el paquete de 500 gemas', expectedResult: 'Se muestra el resumen de la compra con el total 4.99 USD' },
        { number: 3, action: 'Pagar con la tarjeta de prueba', expectedResult: 'La pasarela aprueba el pago' },
        { number: 4, action: 'Revisar el saldo de gemas', expectedResult: 'El saldo muestra 500 gemas' },
      ],
      expectedResult: 'La compra se registra, el saldo es 500 gemas y se envía el comprobante',
      actualResult: 'La compra se registró y el saldo fue 500 gemas',
      executionStatus: 'Exitoso',
      executionDate: '2025-03-20',
      executedBy: 'María Pérez',
      defects: [],
    },
    {
      code: 'CP2',
      title: 'Compra de menor de edad que supera el límite diario',
      requirements: ['REQ2'],
      relatedRules: ['RN2'],
      scenarioType: 'Valor límite',
      designTechnique: 'Análisis de valores límite',
      priority: 'Alta',
      preconditions: 'Jugador autenticado de 15 años con 49.99 USD comprados en el día',
      testData: 'Paquete de 100 gemas (0.99 USD)',
      steps: [
        { number: 1, action: 'Ingresar a la tienda del juego', expectedResult: 'Se listan los paquetes de gemas' },
        { number: 2, action: 'Seleccionar el paquete de 100 gemas y pagar', expectedResult: 'Se rechaza la compra con el mensaje de límite diario' },
      ],
      expectedResult: 'La compra es rechazada y el saldo no cambia',
      actualResult: 'La compra se aprobó y se acreditaron las gemas',
      executionStatus: 'Fallido',
      executionDate: '2025-03-21',
      executedBy: 'María Pérez',
      defects: ['DEF1'],
    },
  ],
  defects: [
    {
      code: 'DEF1',
      title: 'Un menor de edad puede superar el límite diario de compra',
      description: 'El límite de 50 USD no se valida cuando el monto acumulado más la compra lo supera por pocos centavos.',
      stepsToReproduce:
        '1. Iniciar sesión con una cuenta de 15 años con 49.99 USD comprados en el día\n2. Comprar el paquete de 100 gemas (0.99 USD)',
      severity: 'Alta',
      status: 'Cerrado',
      testCases: ['CP2'],
      requirements: ['REQ2'],
      reportedDate: '2025-03-21',
      reportedBy: 'María Pérez',
    },
  ],
};
