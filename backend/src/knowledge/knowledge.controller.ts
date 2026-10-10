import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Action, AppModule } from '../common/access.constants';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ENTITY_DEFINITIONS } from './definitions/entity-definitions';
import { KnowledgeService, ListQuery } from './knowledge.service';

@ApiTags('Base de conocimiento')
@ApiBearerAuth()
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  /** Definiciones de campos usadas por los formularios dinámicos. */
  @Get('definitions')
  @RequirePermission(AppModule.KNOWLEDGE, Action.VIEW)
  definitions() {
    return ENTITY_DEFINITIONS.map(({ collection, modelName, ...def }) => def);
  }

  @Get('summary')
  @RequirePermission(AppModule.KNOWLEDGE, Action.VIEW)
  summary(@Query('project') project?: string) {
    return this.knowledge.summary(project);
  }

  @Get(':type/next-code')
  @RequirePermission(AppModule.KNOWLEDGE, Action.VIEW)
  nextCode(@Param('type') type: string, @Query('project') project: string) {
    return this.knowledge.nextCode(type, project);
  }

  @Get(':type/options')
  @RequirePermission(AppModule.KNOWLEDGE, Action.VIEW)
  options(@Param('type') type: string, @Query('project') project: string) {
    return this.knowledge.options(type, project);
  }

  @Get(':type')
  @RequirePermission(AppModule.KNOWLEDGE, Action.VIEW)
  list(@Param('type') type: string, @Query() query: ListQuery) {
    return this.knowledge.list(type, query);
  }

  @Get(':type/:id')
  @RequirePermission(AppModule.KNOWLEDGE, Action.VIEW)
  get(@Param('type') type: string, @Param('id') id: string) {
    return this.knowledge.get(type, id);
  }

  @Post(':type')
  @RequirePermission(AppModule.KNOWLEDGE, Action.CREATE)
  create(@Param('type') type: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    return this.knowledge.create(type, body, user);
  }

  @Put(':type/:id')
  @RequirePermission(AppModule.KNOWLEDGE, Action.EDIT)
  update(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.knowledge.update(type, id, body, user);
  }

  @Delete(':type/:id')
  @RequirePermission(AppModule.KNOWLEDGE, Action.DELETE)
  remove(@Param('type') type: string, @Param('id') id: string) {
    return this.knowledge.remove(type, id);
  }
}
