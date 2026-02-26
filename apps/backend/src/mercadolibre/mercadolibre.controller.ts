import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Param,
  Query,
  Body,
  Res,
} from '@nestjs/common';
import { MercadoLibreService } from './mercadolibre.service';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';

@ApiTags('mercadolibre')
@Controller('mercadolibre')
export class MercadoLibreController {
  constructor(private readonly mlService: MercadoLibreService) {}

  // ─── OAuth ──────────────────────────────────────────────

  @Get('auth')
  @ApiOperation({ summary: 'Redirect to Mercado Libre for authorization' })
  auth(@Res() res) {
    const url = this.mlService.getAuthUrl();
    return res.redirect(url);
  }

  @Get('callback')
  @ApiOperation({ summary: 'OAuth callback – exchanges code for tokens' })
  async callback(@Query('code') code: string, @Res() res) {
    if (code) {
      await this.mlService.handleCallback(code);
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/mercadolibre?status=success`,
      );
    }
    return res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/mercadolibre?status=error`,
    );
  }

  // ─── Accounts ───────────────────────────────────────────

  @Get('accounts')
  @ApiOperation({ summary: 'List linked Mercado Libre accounts' })
  async getAccounts() {
    return this.mlService.getAccounts();
  }

  @Delete('accounts/:id')
  @ApiOperation({ summary: 'Unlink a Mercado Libre account' })
  async deleteAccount(@Param('id') id: string) {
    return this.mlService.deleteAccount(id);
  }

  // ─── Product Publishing ─────────────────────────────────

  @Post('publish')
  @ApiOperation({ summary: 'Publish a product to Mercado Libre' })
  async publishProduct(
    @Body()
    body: {
      productId: string;
      mlAccountId: string;
      [key: string]: any;
    },
  ) {
    const { productId, mlAccountId, ...overrides } = body;
    return this.mlService.publishProduct(productId, mlAccountId, overrides);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get ML top-level categories' })
  async getCategories() {
    return this.mlService.getCategories();
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get ML subcategories' })
  async getSubcategories(@Param('id') id: string) {
    return this.mlService.getCategories(id);
  }

  @Post('sync/:productId')
  @ApiOperation({ summary: 'Sync product price/stock to Mercado Libre' })
  async syncProduct(@Param('productId') productId: string) {
    return this.mlService.syncProduct(productId);
  }

  @Delete('unpublish/:productId')
  @ApiOperation({ summary: 'Unpublish a product from Mercado Libre' })
  async unpublishProduct(@Param('productId') productId: string) {
    return this.mlService.unpublishProduct(productId);
  }

  @Put('pause/:productId')
  @ApiOperation({ summary: 'Pause a Mercado Libre listing' })
  async pauseProduct(@Param('productId') productId: string) {
    return this.mlService.pauseProduct(productId);
  }

  // ─── Mappings ───────────────────────────────────────────

  @Get('mappings')
  @ApiOperation({ summary: 'List all product mappings' })
  @ApiQuery({ name: 'mlAccountId', required: false })
  async getMappings(@Query('mlAccountId') mlAccountId?: string) {
    return this.mlService.getMappings(mlAccountId);
  }

  @Post('mock-accounts')
  @ApiOperation({ summary: 'Create a mock Mercado Libre account' })
  async createMockAccount() {
    return this.mlService.createMockAccount();
  }
}
