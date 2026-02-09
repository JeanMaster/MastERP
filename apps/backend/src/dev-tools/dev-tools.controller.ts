import { Controller, Post, Get, HttpCode, Res, UseInterceptors, UploadedFile, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DevToolsService } from './dev-tools.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('dev-tools')
@Controller('dev-tools')
@UseGuards(AuthGuard('jwt'))
export class DevToolsController {
    constructor(private readonly devToolsService: DevToolsService) { }

    @Post('reset-database')
    @HttpCode(200)
    @ApiOperation({ summary: 'Resetear base de datos (SOLO DESARROLLO)' })
    @ApiResponse({ status: 200, description: 'Base de datos reseteada' })
    @ApiResponse({ status: 500, description: 'Error al resetear' })
    async resetDatabase() {
        return this.devToolsService.resetDatabase();
    }

    @Post('financial-reset')
    @HttpCode(200)
    @ApiOperation({ summary: 'Reinicio financiero (Borrar transacciones pero mantener maestros)' })
    @ApiResponse({ status: 200, description: 'Datos financieros borrados' })
    async financialReset() {
        return this.devToolsService.financialReset();
    }

    @Get('backup')
    @ApiOperation({ summary: 'Descargar respaldo de base de datos' })
    @ApiResponse({ status: 200, description: 'Archivo SQL de respaldo' })
    async downloadBackup(@Res() res: Response) {
        const { path, filename } = await this.devToolsService.backupDatabase();

        res.download(path, filename, (err) => {
            if (err) {
                console.error('Error al enviar archivo:', err);
            }
            // Opcional: eliminar archivo después de enviar
            // fs.unlinkSync(path);
        });
    }

    @Post('restore')
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({ summary: 'Restaurar base de datos desde archivo SQL' })
    @ApiResponse({ status: 200, description: 'Base de datos restaurada' })
    async restoreDatabase(@UploadedFile() file: any) {
        if (!file) {
            throw new BadRequestException('No se ha subido ningún archivo');
        }

        return this.devToolsService.restoreDatabase(file);
    }
}
