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
  UseGuards,
} from '@nestjs/common';
import { MercadoLibreService } from './mercadolibre.service';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

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

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('accounts')
  @ApiOperation({ summary: 'List linked Mercado Libre accounts' })
  async getAccounts() {
    return this.mlService.getAccounts();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete('accounts/:id')
  @ApiOperation({ summary: 'Unlink a Mercado Libre account' })
  async deleteAccount(@Param('id') id: string) {
    return this.mlService.deleteAccount(id);
  }

  // ─── Product Publishing ─────────────────────────────────

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
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

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('sync/:productId')
  @ApiOperation({ summary: 'Sync product price/stock to Mercado Libre' })
  async syncProduct(@Param('productId') productId: string) {
    return this.mlService.syncProduct(productId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete('unpublish/:productId')
  @ApiOperation({ summary: 'Unpublish a product from Mercado Libre' })
  async unpublishProduct(@Param('productId') productId: string) {
    return this.mlService.unpublishProduct(productId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
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

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @Post('mock-accounts')
  @ApiOperation({ summary: 'Create a mock Mercado Libre account' })
  async createMockAccount() {
    return this.mlService.createMockAccount();
  }
}
