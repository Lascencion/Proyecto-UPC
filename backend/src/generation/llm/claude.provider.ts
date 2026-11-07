import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import { buildUserPrompt, OUTPUT_SCHEMA, SYSTEM_PROMPT } from './prompt';
import { validateResponse } from './response';
import { GenerationError, GenerationInput, GenerationOutput, LlmProvider } from './types';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Proveedor que genera los casos con Claude (API de Anthropic) y salida estructurada. */
export class ClaudeProvider implements LlmProvider {
  readonly name = 'claude';
  private readonly logger = new Logger(ClaudeProvider.name);
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly effort: Effort,
    baseURL = 'https://api.anthropic.com',
  ) {
    // La URL se fija explícitamente para no heredar otra configurada en el entorno.
    this.client = new Anthropic({ apiKey, baseURL, timeout: 5 * 60 * 1000, maxRetries: 2 });
  }

  async generate(input: GenerationInput): Promise<GenerationOutput> {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // Si el modelo declina la solicitud, el servidor la reintenta con el modelo recomendado.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: this.effort, format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      });
    } catch (e) {
      throw new GenerationError(ClaudeProvider.describeError(e));
    }

    if (response.stop_reason === 'refusal') {
      throw new GenerationError('El modelo declinó la solicitud. Revise el texto del requerimiento y vuelva a intentar.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new GenerationError('La respuesta excedió el tamaño permitido. Reduzca la cantidad máxima de casos.');
    }
    const textBlock = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text');
    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock?.text ?? '');
    } catch {
      throw new GenerationError('La respuesta del modelo no es un JSON válido.');
    }
    const { cases, observations, discarded } = validateResponse(parsed, input);
    if (discarded) this.logger.warn(`Se descartaron ${discarded} caso(s) incompletos o por encima del máximo.`);
    return {
      cases,
      observations,
      provider: this.name,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    };
  }

  private static describeError(e: unknown): string {
    if (e instanceof Anthropic.AuthenticationError) return 'La clave de API de Anthropic no es válida.';
    if (e instanceof Anthropic.PermissionDeniedError) return 'La clave de API no tiene permiso para usar el modelo configurado.';
    if (e instanceof Anthropic.NotFoundError) return 'El modelo configurado no existe o no está disponible.';
    if (e instanceof Anthropic.RateLimitError) return 'Se alcanzó el límite de uso de la API. Intente nuevamente en unos minutos.';
    if (e instanceof Anthropic.BadRequestError) return `La API rechazó la solicitud: ${e.message}`;
    if (e instanceof Anthropic.APIConnectionTimeoutError) return 'El modelo tardó demasiado en responder. Intente nuevamente.';
    if (e instanceof Anthropic.APIConnectionError) return 'No se pudo conectar con la API de Anthropic.';
    if (e instanceof Anthropic.APIError) return `Error de la API de Anthropic (${e.status}).`;
    return 'Error inesperado al generar los casos de prueba.';
  }
}
