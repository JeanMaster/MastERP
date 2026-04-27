import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('payments')
@Controller('payments')
@UseGuards(AuthGuard('jwt'))
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Records a new payment for an invoice.
   */
  @Post()
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.createPayment(createPaymentDto);
  }

  /**
   * Retrieves all payments associated with a specific invoice.
   */
  @Get('invoice/:id')
  @ApiOperation({ summary: 'Get all payments for a specific invoice' })
  getByInvoice(@Param('id') id: string) {
    return this.paymentsService.getPaymentsByInvoice(id);
  }

  /**
   * Retrieves all payments in the system.
   */
  @Get()
  @ApiOperation({ summary: 'List all payments' })
  getAll() {
    return this.paymentsService.getAllPayments();
  }

  /**
   * Deletes a payment record and reverts the invoice balance.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a payment and revert invoice balance' })
  remove(@Param('id') id: string) {
    return this.paymentsService.removePayment(id);
  }
}

