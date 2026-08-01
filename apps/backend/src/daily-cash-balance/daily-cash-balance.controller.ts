import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DailyCashBalanceService } from './daily-cash-balance.service';
import { UpsertDailyCashBalanceDto } from './dto/upsert-daily-cash-balance.dto';

@ApiTags('daily-cash-balance')
@Controller('daily-cash-balance')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class DailyCashBalanceController {
  constructor(private readonly service: DailyCashBalanceService) {}

  @Post()
  @ApiOperation({
    summary: 'Record (or update) the Bs closing balance for a day',
  })
  upsert(@Body() dto: UpsertDailyCashBalanceDto) {
    return this.service.upsert(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List recorded daily Bs closing balances' })
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findAll(startDate, endDate);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's recorded balance, if any" })
  findToday() {
    return this.service.findToday();
  }

  @Get('inflation-impact')
  @ApiOperation({
    summary: 'Real day-over-day inflation loss measured from recorded balances',
  })
  @ApiResponse({
    status: 200,
    description: 'Inflation impact computed from real balances',
  })
  getInflationImpact(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getInflationImpact(startDate, endDate);
  }
}
