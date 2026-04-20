import { Controller, Get, Patch, Post, Delete, Body, Param } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas para el dashboard de marketing' })
  async getStats() {
    return this.marketingService.getMarketingStats();
  }

  @Get('config')
  @ApiOperation({ summary: 'Obtener configuración de marketing' })
  async getConfig() {
    return this.marketingService.getConfig();
  }

  @Patch('config')
  @ApiOperation({ summary: 'Actualizar configuración de marketing' })
  async updateConfig(@Body() data: any) {
    return this.marketingService.updateConfig(data);
  }

  @Get('segments')
  @ApiOperation({ summary: 'Obtener segmentos de clientes' })
  async getSegments() {
    return this.marketingService.getSegments();
  }

  @Get('loyalty/top')
  @ApiOperation({ summary: 'Top clientes con más puntos' })
  async getTopEarners() {
    return this.marketingService.getTopEarners();
  }

  @Get('loyalty/:clientId')
  @ApiOperation({ summary: 'Historial de puntos de un cliente' })
  async getClientLoyalty(@Param('clientId') clientId: string) {
    return this.marketingService.getClientLoyaltyHistory(clientId);
  }

  @Post('loyalty/:clientId/adjust')
  @ApiOperation({ summary: 'Ajuste manual de puntos' })
  async adjustPoints(
    @Param('clientId') clientId: string,
    @Body() body: { amount: number; notes: string },
  ) {
    return this.marketingService.adjustPoints(clientId, body.amount, body.notes);
  }

  @Get('loyalty/:clientId/value')
  @ApiOperation({ summary: 'Obtener el valor monetario de los puntos de un cliente' })
  async getPointsValue(@Param('clientId') clientId: string) {
    return this.marketingService.getRedemptionValue(clientId);
  }

  // --- TEMPLATES ---
  @Get('templates')
  @ApiOperation({ summary: 'Obtener plantillas de mensajes' })
  async getTemplates() {
    return this.marketingService.getTemplates();
  }

  @Post('templates')
  @ApiOperation({ summary: 'Crear plantilla de mensaje' })
  async createTemplate(@Body() data: { name: string; content: string; category?: string }) {
    return this.marketingService.createTemplate(data);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Eliminar plantilla' })
  async deleteTemplate(@Param('id') id: string) {
    return this.marketingService.deleteTemplate(id);
  }

  // --- CAMPAIGNS ---
  @Get('campaigns')
  @ApiOperation({ summary: 'Obtener historial de campañas' })
  async getCampaigns() {
    return this.marketingService.getCampaigns();
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Obtener detalles de una campaña' })
  async getCampaignDetails(@Param('id') id: string) {
    return this.marketingService.getCampaignDetails(id);
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Crear campaña y calcular destinatarios' })
  async createCampaign(@Body() data: { name: string; templateId: string; targetSegment: string }) {
    return this.marketingService.createCampaign(data);
  }

  @Patch('campaigns/recipients/:recipientId/sent')
  @ApiOperation({ summary: 'Marcar destinatario como enviado' })
  async markRecipientSent(@Param('recipientId') recipientId: string) {
    return this.marketingService.markRecipientSent(recipientId);
  }

  // --- COUPONS ---
  @Get('coupons')
  @ApiOperation({ summary: 'Obtener lista de cupones' })
  async getCoupons() {
    return this.marketingService.getCoupons();
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Crear nuevo cupón' })
  async createCoupon(@Body() data: any) {
    return this.marketingService.createCoupon(data);
  }

  @Patch('coupons/:id')
  @ApiOperation({ summary: 'Actualizar cupón' })
  async updateCoupon(@Param('id') id: string, @Body() data: any) {
    return this.marketingService.updateCoupon(id, data);
  }

  @Delete('coupons/:id')
  @ApiOperation({ summary: 'Eliminar cupón' })
  async deleteCoupon(@Param('id') id: string) {
    return this.marketingService.deleteCoupon(id);
  }

  @Post('coupons/validate')
  @ApiOperation({ summary: 'Validar cupón desde POS' })
  async validateCoupon(@Body() body: { code: string; clientId?: string; cartItems: any[] }) {
    return this.marketingService.validateCoupon(body.code.toUpperCase(), {
      clientId: body.clientId,
      cartItems: body.cartItems
    });
  }

  // --- SOCIAL HUB ---

  @Post('social/generate')
  @ApiOperation({ summary: 'Generar post para redes sociales con IA' })
  async generateSocialPost(
    @Body() body: { productId: string; platform: string; instructions?: string },
  ) {
    return this.marketingService.generateSocialPost(
      body.productId,
      body.platform,
      body.instructions,
    );
  }

  @Get('social/drafts')
  @ApiOperation({ summary: 'Obtener borradores de posts' })
  async getSocialDrafts() {
    return this.marketingService.getSocialDrafts();
  }

  @Delete('social/drafts/:id')
  @ApiOperation({ summary: 'Eliminar borrador de post' })
  async deleteSocialDraft(@Param('id') id: string) {
    return this.marketingService.deleteSocialDraft(id);
  }
}
