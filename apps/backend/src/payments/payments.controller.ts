import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('payments')
@Controller('payments')
@UseGuards(AuthGuard('jwt'))
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post()
    @ApiOperation({ summary: 'Registrar un pago contra una factura' })
    create(@Body() createPaymentDto: CreatePaymentDto) {
        return this.paymentsService.createPayment(createPaymentDto);
    }

    @Get('invoice/:id')
    @ApiOperation({ summary: 'Obtener pagos de una factura' })
    getByInvoice(@Param('id') id: string) {
        return this.paymentsService.getPaymentsByInvoice(id);
    }

    @Get()
    @ApiOperation({ summary: 'Obtener todos los pagos' })
    getAll() {
        return this.paymentsService.getAllPayments();
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar un pago y revertir balance' })
    remove(@Param('id') id: string) {
        return this.paymentsService.removePayment(id);
    }
}
