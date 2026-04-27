import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('stats')
@Controller('stats')
@UseGuards(AuthGuard('jwt'))
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /**
   * Retrieves summary statistics for the main dashboard.
   */
  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiQuery({
    name: 'range',
    required: false,
    enum: ['7days', '30days', '1year', 'all'],
  })
  getDashboardStats(@Query('range') range?: string) {
    return this.statsService.getDashboardStats(range);
  }

  /**
   * Retrieves an inventory report with stock valuation.
   */
  @Get('inventory')
  @ApiOperation({ summary: 'Get inventory report' })
  @ApiQuery({ name: 'currency', required: false })
  getInventoryReport(@Query('currency') currency: string = 'VES') {
    return this.statsService.getInventoryReport(currency);
  }

  /**
   * Retrieves a comprehensive financial report.
   */
  @Get('finance')
  @ApiOperation({ summary: 'Get finance report' })
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getFinanceReport(
    @Query('currency') currency: string = 'VES',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getFinanceReport(currency, startDate, endDate);
  }

  /**
   * Retrieves a balance report (historical 12 months).
   */
  @Get('balance')
  @ApiOperation({ summary: 'Get balance report' })
  @ApiQuery({ name: 'currency', required: false })
  getBalanceReport(@Query('currency') currency?: string) {
    return this.statsService.getBalanceReport(currency);
  }

  /**
   * Retrieves top-selling products with profit analysis.
   */
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
    @Query('currency') currency: string = 'VES',
  ) {
    return this.statsService.getTopProducts(
      startDate,
      endDate,
      sortBy,
      Number(limit),
      currency,
    );
  }

  /**
   * Retrieves a Cost of Goods Sold (COGS) and restock report.
   */
  @Get('cogs')
  @ApiOperation({ summary: 'Get COGS and restock report' })
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getCOGSReport(
    @Query('currency') currency: string = 'VES',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getCOGSReport(currency, startDate, endDate);
  }

  /**
   * Retrieves an inflation loss report (nominal vs revalued delta).
   */
  @Get('inflation')
  @ApiOperation({
    summary: 'Get inflation loss report (nominal vs revalued delta)',
  })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getInflationReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getInflationReport(startDate, endDate);
  }

  /**
   * Retrieves sales performance by day of the week.
   */
  @Get('weekly-performance')
  @ApiOperation({ summary: 'Get sales performance by day of the week' })
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getWeeklyPerformance(
    @Query('currency') currency: string = 'VES',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getWeeklyPerformance(currency, startDate, endDate);
  }

  /**
   * Retrieves sales performance by day of the month.
   */
  @Get('monthly-daily-performance')
  @ApiOperation({ summary: 'Get sales performance by day of the month (1-31)' })
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getMonthlyDailyPerformance(
    @Query('currency') currency: string = 'VES',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getMonthlyDailyPerformance(
      currency,
      startDate,
      endDate,
    );
  }

  /**
   * Retrieves sales performance by hour of the day.
   */
  @Get('hourly-performance')
  @ApiOperation({ summary: 'Get sales performance by hour of the day (0-23)' })
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'includeSundays', required: false, type: Boolean })
  getHourlyPerformance(
    @Query('currency') currency: string = 'VES',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeSundays') includeSundays: any = 'false',
  ) {
    return this.statsService.getHourlyPerformance(
      currency,
      startDate,
      endDate,
      includeSundays === 'true',
    );
  }

  /**
   * Retrieves a VAT (IVA) report.
   */
  @Get('tax')
  @ApiOperation({ summary: 'Get VAT (IVA) report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getTaxReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getTaxReport(startDate, endDate);
  }

  /**
   * Retrieves an expenses report broken down by category.
   */
  @Get('expenses')
  @ApiOperation({ summary: 'Get expenses report broken down by category' })
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getExpensesReport(
    @Query('currency') currency: string = 'VES',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getExpenseStats(currency, startDate, endDate);
  }

  /**
   * Retrieves a products report with depletion forecast.
   */
  @Get('products-report')
  @ApiOperation({ summary: 'Get all products with depletion forecast' })
  @ApiQuery({ name: 'currency', required: false })
  getProductsReport(@Query('currency') currency: string = 'VES') {
    return this.statsService.getProductsReport(currency);
  }

  /**
   * Retrieves detailed stats for a specific product.
   */
  @Get('product/:id')
  @ApiOperation({ summary: 'Get detailed stats for a specific product' })
  @ApiQuery({ name: 'currency', required: false })
  getProductStats(
    @Param('id') id: string,
    @Query('currency') currency: string = 'VES'
  ) {
    return this.statsService.getProductStats(id, currency);
  }

  /**
   * Retrieves a purchases report broken down by supplier.
   */
  @Get('purchases')
  @ApiOperation({ summary: 'Get purchases report broken down by supplier' })
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getPurchasesReport(
    @Query('currency') currency: string = 'VES',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getPurchasesReport(currency, startDate, endDate);
  }

  /**
   * Retrieves the Sales Book (Libro de Ventas) for fiscal compliance.
   */
  @Get('libro-ventas')
  @ApiOperation({ summary: 'Get Libro de Ventas (Fiscal)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getLibroVentas(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getLibroVentas(startDate, endDate);
  }

  /**
   * Retrieves the Purchases Book (Libro de Compras) for fiscal compliance.
   */
  @Get('libro-compras')
  @ApiOperation({ summary: 'Get Libro de Compras (Fiscal)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getLibroCompras(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getLibroCompras(startDate, endDate);
  }
}
