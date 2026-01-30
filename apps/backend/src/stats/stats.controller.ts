import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('stats')
@Controller('stats')
@UseGuards(AuthGuard('jwt'))
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
    @ApiQuery({ name: 'currency', required: false })
    getInventoryReport(
        @Query('currency') currency: string = 'VES'
    ) {
        return this.statsService.getInventoryReport(currency);
    }

    @Get('finance')
    @ApiOperation({ summary: 'Get finance report' })
    @ApiQuery({ name: 'currency', required: false })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    getFinanceReport(
        @Query('currency') currency: string = 'VES',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.statsService.getFinanceReport(currency, startDate, endDate);
    }

    @Get('balance')
    @ApiOperation({ summary: 'Get balance report' })
    @ApiQuery({ name: 'currency', required: false })
    getBalanceReport(@Query('currency') currency?: string) {
        console.log(`[STATS] getBalanceReport called with currency: '${currency}'`);
        return this.statsService.getBalanceReport(currency);
    }

    @Get('top-products')
    @ApiOperation({ summary: 'Get top selling products' })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiQuery({ name: 'sortBy', required: false, enum: ['units', 'profit'] })
    @ApiQuery({ name: 'limit', required: false })
    getTopProducts(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('sortBy') sortBy: 'units' | 'profit' = 'units',
        @Query('limit') limit: any = 10,
        @Query('currency') currency: string = 'VES'
    ) {
        return this.statsService.getTopProducts(startDate, endDate, sortBy, Number(limit), currency);
    }

    @Get('cogs')
    @ApiOperation({ summary: 'Get COGS and restock report' })
    @ApiQuery({ name: 'currency', required: false })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    getCOGSReport(
        @Query('currency') currency: string = 'VES',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.statsService.getCOGSReport(currency, startDate, endDate);
    }

    @Get('inflation')
    @ApiOperation({ summary: 'Get inflation loss report (nominal vs revalued delta)' })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    getInflationReport(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.statsService.getInflationReport(startDate, endDate);
    }

    @Get('weekly-performance')
    @ApiOperation({ summary: 'Get sales performance by day of the week' })
    @ApiQuery({ name: 'currency', required: false })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    getWeeklyPerformance(
        @Query('currency') currency: string = 'VES',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.statsService.getWeeklyPerformance(currency, startDate, endDate);
    }

    @Get('monthly-daily-performance')
    @ApiOperation({ summary: 'Get sales performance by day of the month (1-31)' })
    @ApiQuery({ name: 'currency', required: false })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    getMonthlyDailyPerformance(
        @Query('currency') currency: string = 'VES',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.statsService.getMonthlyDailyPerformance(currency, startDate, endDate);
    }
}
