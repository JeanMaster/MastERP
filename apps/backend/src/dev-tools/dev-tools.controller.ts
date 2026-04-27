import {
  Controller,
  Post,
  Get,
  HttpCode,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DevToolsService } from './dev-tools.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('dev-tools')
@Controller('dev-tools')
@UseGuards(AuthGuard('jwt'))
export class DevToolsController {
  constructor(private readonly devToolsService: DevToolsService) {}

  /**
   * Resets the entire database (DEVELOPMENT ONLY).
   */
  @Post('reset-database')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset the database (DEVELOPMENT ONLY)' })
  @ApiResponse({ status: 200, description: 'Database reset successfully' })
  @ApiResponse({ status: 500, description: 'Error during reset' })
  async resetDatabase() {
    return this.devToolsService.resetDatabase();
  }

  /**
   * Performs a financial reset: deletes transactions but preserves master data.
   */
  @Post('financial-reset')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Financial reset (delete transactions but keep master data)',
  })
  @ApiResponse({ status: 200, description: 'Financial data cleared successfully' })
  async financialReset() {
    return this.devToolsService.financialReset();
  }

  /**
   * Downloads a SQL backup of the database.
   */
  @Get('backup')
  @ApiOperation({ summary: 'Download a database backup' })
  @ApiResponse({ status: 200, description: 'SQL backup file' })
  async downloadBackup(@Res() res: Response) {
    const { path, filename } = await this.devToolsService.backupDatabase();

    res.download(path, filename, (err) => {
      if (err) {
        console.error('Error sending backup file:', err);
      }
    });
  }

  /**
   * Restores the database from a SQL file.
   */
  @Post('restore')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Restore database from a SQL file' })
  @ApiResponse({ status: 200, description: 'Database restored successfully' })
  async restoreDatabase(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    return this.devToolsService.restoreDatabase(file);
  }
}
