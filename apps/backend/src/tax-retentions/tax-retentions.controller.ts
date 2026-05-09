import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { TaxRetentionsService } from './tax-retentions.service';
import { CreateTaxRetentionDto } from './dto/create-tax-retention.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@ApiTags('tax-retentions')
@Controller('tax-retentions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class TaxRetentionsController {
  constructor(private readonly taxRetentionsService: TaxRetentionsService) {}

  /**
   * Registers a new tax retention voucher.
   */
  @Post()
  @ApiOperation({ summary: 'Register a new tax retention voucher' })
  create(@Body() createTaxRetentionDto: CreateTaxRetentionDto) {
    return this.taxRetentionsService.create(createTaxRetentionDto);
  }

  /**
   * Retrieves all tax retention vouchers.
   */
  @Get()
  @ApiOperation({ summary: 'List all tax retention vouchers' })
  findAll() {
    return this.taxRetentionsService.findAll();
  }

  /**
   * Retrieves details for a specific tax retention voucher.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get details for a specific tax retention voucher' })
  findOne(@Param('id') id: string) {
    return this.taxRetentionsService.findOne(id);
  }

  /**
   * Deletes a tax retention voucher and reverts its impact on balances.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tax retention voucher and revert balances' })
  remove(@Param('id') id: string) {
    return this.taxRetentionsService.remove(id);
  }

  /**
   * Generates a TXT file for SENIAT tax declaration.
   */
  @Get('export/txt')
  @ApiOperation({ summary: 'Generate TXT file for SENIAT tax declaration' })
  async exportTxt(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    
    return this.taxRetentionsService.generateSeniatTxt(startDate, endDate);
  }
}

