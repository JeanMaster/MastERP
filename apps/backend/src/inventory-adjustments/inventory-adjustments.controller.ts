import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@ApiTags('inventory-adjustments')
@Controller('inventory-adjustments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class InventoryAdjustmentsController {
  constructor(
    private readonly inventoryAdjustmentsService: InventoryAdjustmentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an inventory adjustment' })
  @ApiResponse({ status: 201, description: 'Adjustment created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Insufficient stock or invalid data',
  })
  create(@Body() createAdjustmentDto: CreateAdjustmentDto, @Request() req) {
    return this.inventoryAdjustmentsService.create(createAdjustmentDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve inventory adjustments with filters' })
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
  @ApiOperation({ summary: 'Retrieve adjustment history for a specific product' })
  findByProduct(@Param('productId') productId: string) {
    return this.inventoryAdjustmentsService.findByProduct(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve an inventory adjustment by ID' })
  findOne(@Param('id') id: string) {
    return this.inventoryAdjustmentsService.findOne(id);
  }
}
