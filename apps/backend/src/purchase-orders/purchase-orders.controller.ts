import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Purchase Orders')
@Controller('purchase-orders')
@UseGuards(AuthGuard('jwt'))
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  /**
   * Creates a new purchase order.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new purchase order' })
  create(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(createPurchaseOrderDto);
  }

  /**
   * Retrieves all purchase orders.
   */
  @Get()
  @ApiOperation({ summary: 'List all purchase orders' })
  findAll() {
    return this.purchaseOrdersService.findAll();
  }

  /**
   * Retrieves a single purchase order by its ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a purchase order by ID' })
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  /**
   * Updates the status of a purchase order.
   */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update purchase order status' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.purchaseOrdersService.updateStatus(id, status);
  }

  /**
   * Deletes a purchase order.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a purchase order' })
  remove(@Param('id') id: string) {
    return this.purchaseOrdersService.remove(id);
  }
}

