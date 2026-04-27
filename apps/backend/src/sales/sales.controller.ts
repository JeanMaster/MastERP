import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { InvoiceService } from '../invoice/invoice.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { AuthGuard } from '@nestjs/passport';

export interface SalesFilters {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  productId?: string;
  paymentMethod?: string;
  minAmount?: number;
  maxAmount?: number;
  invoiceNumber?: string;
}

@ApiTags('sales')
@Controller('sales')
@UseGuards(AuthGuard('jwt'))
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly invoiceService: InvoiceService,
  ) {}

  /**
   * Creates a new sale record.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new sale' })
  @ApiResponse({ status: 201, description: 'Sale created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or insufficient stock',
  })
  create(@Body() createSaleDto: CreateSaleDto) {
    return this.salesService.create(createSaleDto);
  }

  /**
   * Retrieves sales records matching specific filters.
   */
  @Get()
  @ApiOperation({ summary: 'Retrieve sales with filters' })
  @ApiResponse({ status: 200, description: 'List of filtered sales' })
  findWithFilters(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('clientId') clientId?: string,
    @Query('productId') productId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
    @Query('invoiceNumber') invoiceNumber?: string,
  ) {
    const filters: SalesFilters = {};

    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (clientId) filters.clientId = clientId;
    if (productId) filters.productId = productId;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (minAmount) filters.minAmount = parseFloat(minAmount);
    if (maxAmount) filters.maxAmount = parseFloat(maxAmount);
    if (invoiceNumber) filters.invoiceNumber = invoiceNumber;

    return this.salesService.findWithFilters(filters);
  }

  /**
   * Retrieves all sale records.
   */
  @Get('all')
  @ApiOperation({ summary: 'Retrieve all sales' })
  @ApiResponse({ status: 200, description: 'List of sales' })
  findAll() {
    return this.salesService.findAll();
  }

  /**
   * Retrieves the most recent purchases for a specific client.
   */
  @Get('client/:clientId/recent')
  @ApiOperation({ summary: 'Retrieve a client\'s recent purchases' })
  @ApiResponse({ status: 200, description: 'Recent client purchases' })
  getClientRecentPurchases(
    @Param('clientId') clientId: string,
    @Query('limit') limit?: string,
  ) {
    return this.salesService.getClientRecentPurchases(
      clientId,
      parseInt(limit || '5'),
    );
  }

  /**
   * Updates the payment method of an existing sale.
   */
  @Patch(':id/payment-method')
  @ApiOperation({ summary: 'Update the payment method of a sale' })
  @ApiResponse({ status: 200, description: 'Payment method updated' })
  updatePaymentMethod(
    @Param('id') id: string,
    @Body('paymentMethod') paymentMethod: string,
  ) {
    return this.salesService.updatePaymentMethod(id, paymentMethod);
  }

  /**
   * Deletes a sale record and restores product stock.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sale (and restore stock)' })
  @ApiResponse({ status: 200, description: 'Sale deleted' })
  remove(@Param('id') id: string) {
    return this.salesService.remove(id);
  }

  /**
   * Marks a sale as uncollectible (e.g., loss/theft).
   * DOES NOT restore stock.
   */
  @Delete(':id/uncollectible')
  @ApiOperation({
    summary: 'Declare UNCOLLECTIBLE (Delete sale WITHOUT restoring stock)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sale declared uncollectible and deleted without stock restoral',
  })
  markAsUncollectible(@Param('id') id: string) {
    return this.salesService.markAsUncollectible(id);
  }

  /**
   * Retrieves a single sale record by its ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a sale by ID' })
  @ApiResponse({ status: 200, description: 'Sale found' })
  @ApiResponse({ status: 404, description: 'Sale not found' })
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  /**
   * Retrieves the next available invoice number.
   */
  @Get('next-invoice-number')
  @ApiOperation({ summary: 'Retrieve the next invoice number' })
  @ApiResponse({ status: 200, description: 'Next invoice number' })
  getNextInvoiceNumber() {
    return this.invoiceService.getNextInvoiceNumber();
  }

  /**
   * Reserves an invoice number for immediate use.
   */
  @Get('reserve-invoice-number')
  @ApiOperation({ summary: 'Reserve an invoice number for immediate use' })
  @ApiResponse({ status: 200, description: 'Reserved invoice number' })
  reserveInvoiceNumber() {
    return this.invoiceService.reserveInvoiceNumber();
  }
}
