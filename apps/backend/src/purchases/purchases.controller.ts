import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@ApiTags('purchases')
@Controller('purchases')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  /**
   * Registers a new purchase from a supplier.
   */
  @Post()
  @ApiOperation({ summary: 'Register a new purchase' })
  @ApiResponse({ status: 201, description: 'Purchase registered successfully' })
  create(@Body() createPurchaseDto: CreatePurchaseDto) {
    return this.purchasesService.create(createPurchaseDto);
  }

  /**
   * Registers a payment for an existing purchase.
   */
  @Post('payments')
  @ApiOperation({ summary: 'Register a payment for a purchase' })
  @ApiResponse({ status: 201, description: 'Payment registered successfully' })
  registerPayment(@Body() dto: any) {
    return this.purchasesService.registerPayment(dto);
  }

  /**
   * Retrieves all purchase records.
   */
  @Get()
  @ApiOperation({ summary: 'List all purchases' })
  @ApiResponse({ status: 200, description: 'List of purchases' })
  findAll() {
    return this.purchasesService.findAll();
  }

  /**
   * Retrieves a single purchase record by its ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a purchase by ID' })
  @ApiResponse({ status: 200, description: 'Purchase found' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(id);
  }
}
