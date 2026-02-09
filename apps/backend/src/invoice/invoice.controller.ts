import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('invoice')
@UseGuards(AuthGuard('jwt'))
export class InvoiceController {
    constructor(private readonly invoiceService: InvoiceService) { }

    /**
     * Get the next invoice number (for display purposes, doesn't increment)
     */
    @Get('next')
    async getNextInvoiceNumber() {
        const nextNumber = await this.invoiceService.getNextInvoiceNumber();
        return { invoiceNumber: nextNumber };
    }

    @Post()
    @ApiOperation({ summary: 'Crear factura a crédito' })
    async createCreditInvoice(@Body() createInvoiceDto: CreateInvoiceDto) {
        return this.invoiceService.createCreditInvoice({
            clientId: createInvoiceDto.clientId,
            saleId: createInvoiceDto.saleId,
            subtotal: createInvoiceDto.subtotal,
            discount: createInvoiceDto.discount,
            tax: createInvoiceDto.tax,
            total: createInvoiceDto.total,
            dueDate: createInvoiceDto.dueDate ? new Date(createInvoiceDto.dueDate) : undefined,
            notes: createInvoiceDto.notes,
        });
    }

    @Get('client/:clientId')
    @ApiOperation({ summary: 'Obtener facturas de un cliente' })
    getClientInvoices(@Param('clientId') clientId: string) {
        return this.invoiceService.getClientInvoices(clientId);
    }

    @Get('pending')
    @ApiOperation({ summary: 'Obtener facturas pendientes' })
    getPendingInvoices() {
        return this.invoiceService.getPendingInvoices();
    }

    @Get('overdue')
    @ApiOperation({ summary: 'Obtener facturas vencidas' })
    getOverdueInvoices() {
        return this.invoiceService.getOverdueInvoices();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener factura por ID' })
    getInvoiceById(@Param('id') id: string) {
        return this.invoiceService.getInvoiceById(id);
    }

    /**
     * Get current counter status
     */
    @Get('counter')
    async getCurrentCounter() {
        return this.invoiceService.getCurrentCounter();
    }
}
