import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('company-settings')
@Controller('company-settings')
export class CompanySettingsController {
  constructor(
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Obtener configuración de la empresa' })
  @ApiResponse({ status: 200, description: 'Configuración obtenida' })
  getSettings() {
    return this.companySettingsService.getSettings();
  }

  @UseGuards(AuthGuard('jwt'))
  @Put()
  @ApiOperation({ summary: 'Actualizar configuración de la empresa' })
  @ApiResponse({ status: 200, description: 'Configuración actualizada' })
  updateSettings(@Body() updateDto: UpdateCompanySettingsDto) {
    return this.companySettingsService.updateSettings(updateDto);
  }
}
