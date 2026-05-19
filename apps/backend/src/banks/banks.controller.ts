import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BanksService } from './banks.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { LiquidatePosBatchDto } from './dto/liquidate-pos-batch.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('banks')
@Controller('banks')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('liquidate-pos')
  @ApiOperation({ summary: 'Liquidate a POS batch and transfer net funds to bank account' })
  @ApiResponse({ status: 200, description: 'Batch liquidated successfully' })
  liquidatePosBatch(@Body() dto: LiquidatePosBatchDto, @Request() req) {
    return this.banksService.liquidatePosBatch(dto, req.user.id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  @ApiOperation({ summary: 'Create a new bank account' })
  @ApiResponse({ status: 201, description: 'Bank account created successfully' })
  create(@Body() createBankDto: CreateBankAccountDto) {
    return this.banksService.create(createBankDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve all active bank accounts' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by bank name, holder, or account number' })
  findAll(@Query('search') search?: string) {
    return this.banksService.findAll(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a bank account by ID' })
  @ApiResponse({ status: 200, description: 'Bank account found' })
  @ApiResponse({ status: 404, description: 'Bank account not found' })
  findOne(@Param('id') id: string) {
    return this.banksService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get(':id/history')
  @ApiOperation({ summary: 'Retrieve movement history for a bank account' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records' })
  getHistory(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.banksService.getHistory(id, limit ? Number(limit) : 50);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('movements')
  @ApiOperation({ summary: 'Record a manual bank movement' })
  @ApiResponse({ status: 201, description: 'Movement recorded successfully' })
  addMovement(@Body() dto: any) {
    return this.banksService.addMovement(dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update bank account information' })
  @ApiResponse({ status: 200, description: 'Bank account updated successfully' })
  update(@Param('id') id: string, @Body() updateBankDto: UpdateBankAccountDto) {
    return this.banksService.update(id, updateBankDto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a bank account (soft delete)' })
  @ApiResponse({ status: 200, description: 'Bank account deactivated' })
  remove(@Param('id') id: string) {
    return this.banksService.remove(id);
  }
}
