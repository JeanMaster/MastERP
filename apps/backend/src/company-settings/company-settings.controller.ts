import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@ApiTags('company-settings')
@Controller('company-settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CompanySettingsController {
  constructor(
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  /**
   * Retrieves the company settings.
   */
  @Get()
  @ApiOperation({ summary: 'Get company settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  getSettings() {
    return this.companySettingsService.getSettings();
  }

  /**
   * Updates the company settings.
   */
  @Roles(Role.ADMIN)
  @Put()
  @ApiOperation({ summary: 'Update company settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  updateSettings(@Body() updateDto: UpdateCompanySettingsDto) {
    return this.companySettingsService.updateSettings(updateDto);
  }
}
