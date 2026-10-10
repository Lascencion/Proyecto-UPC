import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { FlowModule, FlowModuleSchema, Project, ProjectSchema } from './catalog.schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: FlowModule.name, schema: FlowModuleSchema },
    ]),
  ],
  controllers: [CatalogsController],
  providers: [CatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
