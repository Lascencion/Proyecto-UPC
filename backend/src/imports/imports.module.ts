import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ImportBatch, ImportBatchSchema, ImportRow, ImportRowSchema } from './import.schemas';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [
    KnowledgeModule,
    CatalogsModule,
    MongooseModule.forFeature([
      { name: ImportBatch.name, schema: ImportBatchSchema },
      { name: ImportRow.name, schema: ImportRowSchema },
    ]),
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
