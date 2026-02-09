import { Controller, Get, Post, Body, Param, Query, Patch, Delete, UseGuards } from '@nestjs/common';
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
        private readonly invoiceService: InvoiceService
    ) { }

    @Post()
    @ApiOperation({ summary: 'Crear una nueva venta' })
    @ApiResponse({ status: 201, description: 'Venta creada exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos o stock insuficiente' })
    create(@Body() createSaleDto: CreateSaleDto) {
        return this.salesService.create(createSaleDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar ventas con filtros' })
    @ApiResponse({ status: 200, description: 'Lista de ventas filtradas' })
    findWithFilters(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('clientId') clientId?: string,
        @Query('productId') productId?: string,
        @Query('paymentMethod') paymentMethod?: string,
        @Query('minAmount') minAmount?: string,
        @Query('maxAmount') maxAmount?: string,
        @Query('invoiceNumber') invoiceNumber?: string
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

    @Get('all')
    @ApiOperation({ summary: 'Listar todas las ventas' })
    @ApiResponse({ status: 200, description: 'Lista de ventas' })
    findAll() {
        return this.salesService.findAll();
    }

    @Get('client/:clientId/recent')
    @ApiOperation({ summary: 'Obtener las últimas compras de un cliente' })
    @ApiResponse({ status: 200, description: 'Últimas compras del cliente' })
    getClientRecentPurchases(
        @Param('clientId') clientId: string,
        @Query('limit') limit?: string
    ) {
        return this.salesService.getClientRecentPurchases(clientId, parseInt(limit || '5'));
    }

    @Patch(':id/payment-method')
    @ApiOperation({ summary: 'Actualizar método de pago de una venta' })
    @ApiResponse({ status: 200, description: 'Método de pago actualizado' })
    updatePaymentMethod(
        @Param('id') id: string,
        @Body('paymentMethod') paymentMethod: string
    ) {
        return this.salesService.updatePaymentMethod(id, paymentMethod);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar una venta (y restaurar stock)' })
    @ApiResponse({ status: 200, description: 'Venta eliminada' })
    remove(@Param('id') id: string) {
        return this.salesService.remove(id);
    }

    @Delete(':id/uncollectible')
    @ApiOperation({ summary: 'Declarar IMPAGO (Eliminar venta SIN restaurar stock)' })
    @ApiResponse({ status: 200, description: 'Venta declarada incobrable y eliminada sin stock' })
    markAsUncollectible(@Param('id') id: string) {
        return this.salesService.markAsUncollectible(id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener una venta por ID' })
    @ApiResponse({ status: 200, description: 'Venta encontrada' })
    @ApiResponse({ status: 404, description: 'Venta no encontrada' })
    findOne(@Param('id') id: string) {
        return this.salesService.findOne(id);
    }

    @Get('next-invoice-number')
    @ApiOperation({ summary: 'Obtener el próximo número de factura' })
    @ApiResponse({ status: 200, description: 'Próximo número de factura' })
    getNextInvoiceNumber() {
        return this.invoiceService.getNextInvoiceNumber();
    }

    @Get('reserve-invoice-number')
    @ApiOperation({ summary: 'Reservar un número de factura para uso inmediato' })
    @ApiResponse({ status: 200, description: 'Número de factura reservado' })
    reserveInvoiceNumber() {
        return this.invoiceService.reserveInvoiceNumber();
    }
}