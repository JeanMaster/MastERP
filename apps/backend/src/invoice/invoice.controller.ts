import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@Controller('invoice')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Retrieves the next invoice number for display purposes (without incrementing).
   */
  @Get('next')
  async getNextInvoiceNumber() {
    const nextNumber = await this.invoiceService.getNextInvoiceNumber();
    return { invoiceNumber: nextNumber };
  }

  @Post()
  @ApiOperation({ summary: 'Create a credit invoice' })
  async createCreditInvoice(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoiceService.createCreditInvoice({
      clientId: createInvoiceDto.clientId,
      saleId: createInvoiceDto.saleId,
      subtotal: createInvoiceDto.subtotal,
      discount: createInvoiceDto.discount,
      tax: createInvoiceDto.tax,
      total: createInvoiceDto.total,
      dueDate: createInvoiceDto.dueDate
        ? new Date(createInvoiceDto.dueDate)
        : undefined,
      notes: createInvoiceDto.notes,
    });
  }

  @Get('client/:clientId')
  @ApiOperation({ summary: 'Retrieve invoices for a specific client' })
  getClientInvoices(@Param('clientId') clientId: string) {
    return this.invoiceService.getClientInvoices(clientId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('pending')
  @ApiOperation({ summary: 'Retrieve all pending invoices' })
  getPendingInvoices() {
    return this.invoiceService.getPendingInvoices();
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('overdue')
  @ApiOperation({ summary: 'Retrieve all overdue invoices' })
  getOverdueInvoices() {
    return this.invoiceService.getOverdueInvoices();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve an invoice by ID' })
  getInvoiceById(@Param('id') id: string) {
    return this.invoiceService.getInvoiceById(id);
  }

  /**
   * Retrieves the current status of the invoice counter.
   */
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('counter')
  async getCurrentCounter() {
    return this.invoiceService.getCurrentCounter();
  }
}
