import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('inventory-adjustments')
@Controller('inventory-adjustments')
@UseGuards(AuthGuard('jwt'))
export class InventoryAdjustmentsController {
  constructor(
    private readonly inventoryAdjustmentsService: InventoryAdjustmentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear ajuste de inventario' })
  @ApiResponse({ status: 201, description: 'Ajuste creado exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'Stock insuficiente o datos inválidos',
  })
  create(@Body() createAdjustmentDto: CreateAdjustmentDto) {
    return this.inventoryAdjustmentsService.create(createAdjustmentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar ajustes con filtros' })
  findAll(
    @Query('productId') productId?: string,
    @Query('type') type?: string,
    @Query('reason') reason?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = {};
    if (productId) filters.productId = productId;
    if (type) filters.type = type;
    if (reason) filters.reason = reason;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    return this.inventoryAdjustmentsService.findAll(filters);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Obtener historial de ajustes de un producto' })
  findByProduct(@Param('productId') productId: string) {
    return this.inventoryAdjustmentsService.findByProduct(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener ajuste por ID' })
  findOne(@Param('id') id: string) {
    return this.inventoryAdjustmentsService.findOne(id);
  }
}
