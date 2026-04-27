import { Controller, Get, Patch, Post, Delete, Body, Param } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Retrieve statistics for the marketing dashboard' })
  async getStats() {
    return this.marketingService.getMarketingStats();
  }

  @Get('config')
  @ApiOperation({ summary: 'Retrieve marketing configuration' })
  async getConfig() {
    return this.marketingService.getConfig();
  }

  @Patch('config')
  @ApiOperation({ summary: 'Update marketing configuration' })
  async updateConfig(@Body() data: any) {
    return this.marketingService.updateConfig(data);
  }

  @Get('segments')
  @ApiOperation({ summary: 'Retrieve client segments' })
  async getSegments() {
    return this.marketingService.getSegments();
  }

  @Get('loyalty/top')
  @ApiOperation({ summary: 'Retrieve top loyalty earners' })
  async getTopEarners() {
    return this.marketingService.getTopEarners();
  }

  @Get('loyalty/:clientId')
  @ApiOperation({ summary: 'Retrieve loyalty history for a specific client' })
  async getClientLoyalty(@Param('clientId') clientId: string) {
    return this.marketingService.getClientLoyaltyHistory(clientId);
  }

  @Post('loyalty/:clientId/adjust')
  @ApiOperation({ summary: 'Perform manual points adjustment' })
  async adjustPoints(
    @Param('clientId') clientId: string,
    @Body() body: { amount: number; notes: string },
  ) {
    return this.marketingService.adjustPoints(clientId, body.amount, body.notes);
  }

  @Get('loyalty/:clientId/value')
  @ApiOperation({ summary: 'Retrieve the monetary value of a client\'s points' })
  async getPointsValue(@Param('clientId') clientId: string) {
    return this.marketingService.getRedemptionValue(clientId);
  }

  // --- TEMPLATES ---
  @Get('templates')
  @ApiOperation({ summary: 'Retrieve message templates' })
  async getTemplates() {
    return this.marketingService.getTemplates();
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a new message template' })
  async createTemplate(@Body() data: { name: string; content: string; category?: string }) {
    return this.marketingService.createTemplate(data);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a message template' })
  async deleteTemplate(@Param('id') id: string) {
    return this.marketingService.deleteTemplate(id);
  }

  // --- CAMPAIGNS ---
  @Get('campaigns')
  @ApiOperation({ summary: 'Retrieve campaign history' })
  async getCampaigns() {
    return this.marketingService.getCampaigns();
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Retrieve campaign details' })
  async getCampaignDetails(@Param('id') id: string) {
    return this.marketingService.getCampaignDetails(id);
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create a campaign and calculate recipients' })
  async createCampaign(@Body() data: { name: string; templateId: string; targetSegment: string }) {
    return this.marketingService.createCampaign(data);
  }

  @Patch('campaigns/recipients/:recipientId/sent')
  @ApiOperation({ summary: 'Mark recipient as sent' })
  async markRecipientSent(@Param('recipientId') recipientId: string) {
    return this.marketingService.markRecipientSent(recipientId);
  }

  // --- COUPONS ---
  @Get('coupons')
  @ApiOperation({ summary: 'Retrieve list of coupons' })
  async getCoupons() {
    return this.marketingService.getCoupons();
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Create a new coupon' })
  async createCoupon(@Body() data: any) {
    return this.marketingService.createCoupon(data);
  }

  @Patch('coupons/:id')
  @ApiOperation({ summary: 'Update a coupon' })
  async updateCoupon(@Param('id') id: string, @Body() data: any) {
    return this.marketingService.updateCoupon(id, data);
  }

  @Delete('coupons/:id')
  @ApiOperation({ summary: 'Delete a coupon' })
  async deleteCoupon(@Param('id') id: string) {
    return this.marketingService.deleteCoupon(id);
  }

  @Post('coupons/validate')
  @ApiOperation({ summary: 'Validate a coupon from POS' })
  async validateCoupon(@Body() body: { code: string; clientId?: string; cartItems: any[] }) {
    return this.marketingService.validateCoupon(body.code.toUpperCase(), {
      clientId: body.clientId,
      cartItems: body.cartItems
    });
  }

  // --- SOCIAL HUB ---

  @Post('social/generate')
  @ApiOperation({ summary: 'Generate a social media post using AI' })
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
  @ApiOperation({ summary: 'Retrieve social post drafts' })
  async getSocialDrafts() {
    return this.marketingService.getSocialDrafts();
  }

  @Delete('social/drafts/:id')
  @ApiOperation({ summary: 'Delete a social post draft' })
  async deleteSocialDraft(@Param('id') id: string) {
    return this.marketingService.deleteSocialDraft(id);
  }
}
