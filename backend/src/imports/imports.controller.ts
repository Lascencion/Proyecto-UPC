import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Action, AppModule } from '../common/access.constants';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateImportDto, UpdateBatchDto, UpdateRowDto } from './dto/import.dto';
import { ImportsService } from './imports.service';

export const MAX_FILES = 10;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

@ApiTags('Carga masiva')
@ApiBearerAuth()
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  @RequirePermission(AppModule.KNOWLEDGE, Action.BULK_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES, { limits: { fileSize: MAX_FILE_SIZE } }))
  create(@UploadedFiles() files: Express.Multer.File[], @Body() dto: CreateImportDto, @CurrentUser() user: AuthUser) {
    // multer decodifica el nombre como latin1; se corrige para conservar tildes y ñ.
    const named = (files ?? []).map((f) => ({ ...f, originalname: Buffer.from(f.originalname, 'latin1').toString('utf8') }));
    return this.imports.create(named, dto, user);
  }

  @Get()
  @RequirePermission(AppModule.KNOWLEDGE, Action.BULK_UPLOAD)
  list(@Query('project') project?: string) {
    return this.imports.list(project);
  }

  @Get(':id')
  @RequirePermission(AppModule.KNOWLEDGE, Action.BULK_UPLOAD)
  get(@Param('id') id: string) {
    return this.imports.get(id);
  }

  @Patch(':id')
  @RequirePermission(AppModule.KNOWLEDGE, Action.BULK_UPLOAD)
  updateBatch(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return this.imports.updateBatch(id, dto.duplicateStrategy);
  }

  @Patch(':id/rows/:rowId')
  @RequirePermission(AppModule.KNOWLEDGE, Action.BULK_UPLOAD)
  updateRow(@Param('id') id: string, @Param('rowId') rowId: string, @Body() dto: UpdateRowDto) {
    return this.imports.updateRow(id, rowId, dto);
  }

  @Post(':id/confirm')
  @RequirePermission(AppModule.KNOWLEDGE, Action.BULK_UPLOAD)
  confirm(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.imports.confirm(id, user);
  }

  @Post(':id/cancel')
  @RequirePermission(AppModule.KNOWLEDGE, Action.BULK_UPLOAD)
  cancel(@Param('id') id: string) {
    return this.imports.cancel(id);
  }
}
