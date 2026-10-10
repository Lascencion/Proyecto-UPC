import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Action, AppModule } from '../common/access.constants';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CatalogsService } from './catalogs.service';
import { CreateFlowModuleDto, CreateProjectDto, UpdateFlowModuleDto, UpdateProjectDto } from './dto/catalog.dto';

/**
 * La lectura de catálogos solo exige sesión iniciada: los formularios de la base
 * de conocimiento los necesitan aunque el rol no administre catálogos.
 */
@ApiTags('Catálogos')
@ApiBearerAuth()
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogs: CatalogsService) {}

  @Get('projects')
  @ApiQuery({ name: 'activeOnly', required: false })
  listProjects(@Query('activeOnly') activeOnly?: string) {
    return this.catalogs.listProjects(activeOnly !== 'true');
  }

  @Post('projects')
  @RequirePermission(AppModule.CATALOGS, Action.CREATE)
  createProject(@Body() dto: CreateProjectDto) {
    return this.catalogs.createProject(dto);
  }

  @Patch('projects/:id')
  @RequirePermission(AppModule.CATALOGS, Action.EDIT)
  updateProject(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.catalogs.updateProject(id, dto);
  }

  @Delete('projects/:id')
  @RequirePermission(AppModule.CATALOGS, Action.DELETE)
  deleteProject(@Param('id') id: string) {
    return this.catalogs.deleteProject(id);
  }

  @Get('modules')
  @ApiQuery({ name: 'project', required: false })
  @ApiQuery({ name: 'activeOnly', required: false })
  listModules(@Query('project') project?: string, @Query('activeOnly') activeOnly?: string) {
    return this.catalogs.listModules(project, activeOnly !== 'true');
  }

  @Post('modules')
  @RequirePermission(AppModule.CATALOGS, Action.CREATE)
  createModule(@Body() dto: CreateFlowModuleDto) {
    return this.catalogs.createModule(dto);
  }

  @Patch('modules/:id')
  @RequirePermission(AppModule.CATALOGS, Action.EDIT)
  updateModule(@Param('id') id: string, @Body() dto: UpdateFlowModuleDto) {
    return this.catalogs.updateModule(id, dto);
  }

  @Delete('modules/:id')
  @RequirePermission(AppModule.CATALOGS, Action.DELETE)
  deleteModule(@Param('id') id: string) {
    return this.catalogs.deleteModule(id);
  }
}
