import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ContextService } from './context.service';
import { GeneratedCaseDoc, GeneratedCaseSchema, GenerationRequest, GenerationRequestSchema } from './generation.schemas';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { ClaudeProvider } from './llm/claude.provider';
import { SimulatedProvider } from './llm/simulated.provider';
import { LLM_PROVIDER, LlmProvider } from './llm/types';

/**
 * Proveedor del LLM según la configuración:
 * - LLM_PROVIDER=claude usa la API de Anthropic (requiere ANTHROPIC_API_KEY).
 * - LLM_PROVIDER=simulado genera casos de ejemplo sin costo.
 * - Sin LLM_PROVIDER: Claude si hay clave configurada; si no, simulado.
 */
function providerFactory(config: ConfigService): LlmProvider {
  const logger = new Logger('LlmProvider');
  const key = config.get<string>('ANTHROPIC_API_KEY');
  const wanted = config.get<string>('LLM_PROVIDER') || (key ? 'claude' : 'simulado');
  if (wanted === 'claude') {
    if (!key) {
      logger.warn('LLM_PROVIDER=claude sin ANTHROPIC_API_KEY: se usará el modo simulado.');
      return new SimulatedProvider();
    }
    const model = config.get<string>('LLM_MODEL', 'claude-sonnet-5-5');
    const effort = config.get<string>('LLM_EFFORT', 'medium') as 'low' | 'medium' | 'high' | 'xhigh' | 'max';
    logger.log(`Generación con Claude (${model}, esfuerzo ${effort}).`);
    return new ClaudeProvider(key, model, effort, config.get<string>('LLM_BASE_URL') || undefined);
  }
  logger.log('Generación en modo simulado (sin LLM).');
  return new SimulatedProvider();
}

@Module({
  imports: [
    KnowledgeModule,
    MongooseModule.forFeature([
      { name: GenerationRequest.name, schema: GenerationRequestSchema },
      { name: GeneratedCaseDoc.name, schema: GeneratedCaseSchema },
    ]),
  ],
  controllers: [GenerationController],
  providers: [
    GenerationService,
    ContextService,
    { provide: LLM_PROVIDER, inject: [ConfigService], useFactory: providerFactory },
  ],
})
export class GenerationModule {}
