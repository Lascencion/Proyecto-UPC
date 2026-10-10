import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { ENTITY_DEFINITIONS } from './definitions/entity-definitions';
import { CodeGeneratorService } from './code-generator.service';
import { KnowledgeController } from './knowledge.controller';
import { buildKnowledgeSchema } from './knowledge.schemas';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [
    CatalogsModule,
    MongooseModule.forFeature(ENTITY_DEFINITIONS.map((def) => ({ name: def.modelName, schema: buildKnowledgeSchema(def) }))),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, CodeGeneratorService],
  exports: [KnowledgeService, CodeGeneratorService],
})
export class KnowledgeModule {}
