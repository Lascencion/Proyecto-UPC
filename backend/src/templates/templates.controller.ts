import { Controller, Get, NotFoundException, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Action, AppModule } from '../common/access.constants';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TemplateFile, TemplatesService } from './templates.service';

@ApiTags('Plantillas de carga masiva')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get(':format')
  @RequirePermission(AppModule.KNOWLEDGE, Action.VIEW)
  @ApiQuery({ name: 'type', required: false, description: 'Solo CSV: requirements, business-rules, test-cases, test-case-steps, defects' })
  async download(@Param('format') format: string, @Query('type') type: string, @Res({ passthrough: true }) res: Response) {
    let file: TemplateFile;
    if (format === 'xlsx') file = await this.templates.excel();
    else if (format === 'docx') file = await this.templates.word();
    else if (format === 'csv') file = this.templates.csv(type);
    else throw new NotFoundException('Formato de plantilla no soportado (xlsx, docx o csv).');
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
    });
    return new StreamableFile(file.buffer);
  }
}
