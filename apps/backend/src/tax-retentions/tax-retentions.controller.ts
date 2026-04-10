import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { TaxRetentionsService } from './tax-retentions.service';
import { CreateTaxRetentionDto } from './dto/create-tax-retention.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('tax-retentions')
@Controller('tax-retentions')
export class TaxRetentionsController {
  constructor(private readonly taxRetentionsService: TaxRetentionsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo comprobante de retención' })
  create(@Body() createTaxRetentionDto: CreateTaxRetentionDto) {
    return this.taxRetentionsService.create(createTaxRetentionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los comprobantes de retención' })
  findAll() {
    return this.taxRetentionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de un comprobante de retención' })
  findOne(@Param('id') id: string) {
    return this.taxRetentionsService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un comprobante de retención y revertir saldo' })
  remove(@Param('id') id: string) {
    return this.taxRetentionsService.remove(id);
  }

  @Get('export/txt')
  @ApiOperation({ summary: 'Generar archivo TXT para declaración del SENIAT' })
  async exportTxt(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    
    return this.taxRetentionsService.generateSeniatTxt(startDate, endDate);
  }
}
