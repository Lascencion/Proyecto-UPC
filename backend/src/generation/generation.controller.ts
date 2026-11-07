import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Action, AppModule } from '../common/access.constants';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ContextQueryDto, CreateGenerationDto } from './dto/generation.dto';
import { GenerationService } from './generation.service';

@ApiTags('Generación de casos de prueba')
@ApiBearerAuth()
@Controller('generation')
export class GenerationController {
  constructor(private readonly generation: GenerationService) {}

  @Get('config')
  @RequirePermission(AppModule.GENERATION, Action.VIEW)
  config() {
    return this.generation.config();
  }

  /** HU09: información histórica sugerida para un requerimiento. */
  @Post('context')
  @HttpCode(200)
  @RequirePermission(AppModule.GENERATION, Action.CREATE)
  context(@Body() dto: ContextQueryDto) {
    return this.generation.suggestContext(dto);
  }

  @Get('records')
  @RequirePermission(AppModule.GENERATION, Action.CREATE)
  records(@Query('project') project: string, @Query('q') q: string) {
    return this.generation.searchRecords(project, q);
  }

  /** HU10: crea la solicitud y genera los casos con el LLM. */
  @Post()
  @RequirePermission(AppModule.GENERATION, Action.CREATE)
  create(@Body() dto: CreateGenerationDto, @CurrentUser() user: AuthUser) {
    return this.generation.create(dto, user);
  }

  @Get()
  @RequirePermission(AppModule.GENERATION, Action.VIEW)
  list(@Query() query: { project?: string; status?: string; search?: string; mine?: string }, @CurrentUser() user: AuthUser) {
    return this.generation.list(query, user);
  }

  @Get(':id')
  @RequirePermission(AppModule.GENERATION, Action.VIEW)
  get(@Param('id') id: string) {
    return this.generation.get(id);
  }
}
