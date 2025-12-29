import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
    constructor(private readonly statsService: StatsService) { }

    @Get('dashboard')
    @ApiOperation({ summary: 'Get dashboard statistics' })
    @ApiQuery({ name: 'range', required: false, enum: ['7days', '30days', '1year', 'all'] })
    getDashboardStats(@Query('range') range?: string) {
        return this.statsService.getDashboardStats(range);
    }

    @Get('inventory')
    @ApiOperation({ summary: 'Get inventory report' })
    getInventoryReport() {
        return this.statsService.getInventoryReport();
    }

    @Get('finance')
    @ApiOperation({ summary: 'Get finance report' })
    getFinanceReport() {
        return this.statsService.getFinanceReport();
    }

    @Get('balance')
    @ApiOperation({ summary: 'Get balance report' })
    @ApiQuery({ name: 'currency', required: false })
    getBalanceReport(@Query('currency') currency?: string) {
        console.log(`[STATS] getBalanceReport called with currency: '${currency}'`);
        return this.statsService.getBalanceReport(currency);
    }
}
