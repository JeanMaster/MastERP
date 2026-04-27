import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { MarketingConfig, Client, Sale } from '@prisma/client';

dayjs.extend(isBetween);

export enum ClientTier {
  VIP = 'VIP',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  BRONZE = 'BRONZE',
}

@Injectable()
export class MarketingService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private aiService: AIService
  ) {}

  async onModuleInit() {
    // Initialize default config if not exists
    const configCount = await this.prisma.marketingConfig.count();
    if (configCount === 0) {
      await this.prisma.marketingConfig.create({
        data: {
          tierVipThreshold: 1000,
          tierGoldThreshold: 500,
          tierSilverThreshold: 200,
          churnDays: 30,
          pointsPerUSD: 1.0,
          valuePerPoint: 0.01,
          maxRedemptionPercentage: 100,
        },
      });
    }
  }

  /**
   * Retrieves the current marketing configuration.
   * @returns The first marketing configuration found.
   */
  async getConfig(): Promise<MarketingConfig | null> {
    return this.prisma.marketingConfig.findFirst();
  }

  /**
   * Updates the marketing configuration.
   * @param data The partial configuration data to update.
   * @returns The updated marketing configuration.
   */
  async updateConfig(data: Partial<MarketingConfig>) {
    const config = await this.getConfig();
    if (!config) throw new Error('Marketing configuration not initialized');
    
    return this.prisma.marketingConfig.update({
      where: { id: config.id },
      data,
    });
  }

  /**
   * Calculates the total marketing statistics including tiers, churn, and upcoming birthdays.
   * @returns An object containing tiers distribution, churn stats, and a list of upcoming birthdays.
   */
  async getMarketingStats() {
    const config = await this.getConfig();
    if (!config) return null; // Safety check
    
    const now = dayjs();
    const churnDate = now.subtract(config.churnDays, 'day').toDate();

    const clientStats = await this.prisma.client.findMany({
      where: { active: true },
      include: {
        sales: {
          where: { active: true },
          select: { total: true, date: true, exchangeRate: true },
        },
      },
    });

    // Process tiers
    const tiers = {
      vip: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
    };

    let churnCount = 0;
    const upcomingBirthdays: any[] = [];

    clientStats.forEach(client => {
      const totalSpentUSD = this.calculateTotalSpentUSD(client.sales as any[]);
      const tier = this.calculateClientTier(totalSpentUSD, config);

      if (tier === ClientTier.VIP) tiers.vip++;
      else if (tier === ClientTier.GOLD) tiers.gold++;
      else if (tier === ClientTier.SILVER) tiers.silver++;
      else tiers.bronze++;

      // Check Churn
      const lastSale = client.sales.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
      if (lastSale && dayjs(lastSale.date).isBefore(churnDate)) {
        churnCount++;
      }

      // Check Birthday (this month)
      if (client.birthDate) {
        const bday = dayjs(client.birthDate);
        if (bday.month() === now.month()) {
          upcomingBirthdays.push({
            id: client.id,
            name: client.name,
            phone: client.phone,
            birthDate: client.birthDate,
            day: bday.date(),
          });
        }
      }
    });

    return {
      tiers,
      churn: {
        count: churnCount,
        totalClients: clientStats.length,
        percentage: clientStats.length > 0 ? (churnCount / clientStats.length) * 100 : 0,
        days: config.churnDays,
      },
      upcomingBirthdays: upcomingBirthdays.sort((a, b) => a.day - b.day),
    };
  }

  /**
   * Retrieves a list of active clients with their last sale date and total sales count.
   * @returns A list of client segments.
   */
  async getSegments() {
    const clients = await this.prisma.client.findMany({
      where: { active: true },
      include: {
        sales: {
            where: { active: true },
            orderBy: { date: 'desc' },
            take: 1
        }
      }
    });

    return clients.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        lastSale: c.sales[0]?.date || null,
        totalSales: c.sales.length
    }));
  }

  /**
   * Awards loyalty points to a client for a sale.
   * Called from SalesService.
   * @param clientId The ID of the client.
   * @param saleId The ID of the sale.
   * @param saleTotalUSD The total amount of the sale in USD.
   * @returns The created loyalty movement or null if no points were earned.
   */
  async earnPoints(clientId: string, saleId: string, saleTotalUSD: number) {
    const config = await this.getConfig();
    if (!config) return null;

    const pointsPerUSD = Number(config.pointsPerUSD) || 1;
    const pointsEarned = Math.floor(saleTotalUSD * pointsPerUSD * 100) / 100;

    if (pointsEarned <= 0) return null;

    // Create movement + update client balance in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const movement = await tx.loyaltyMovement.create({
        data: {
          clientId,
          saleId,
          amount: pointsEarned,
          type: 'EARNED',
          notes: `Points earned for sale`,
        },
      });

      await tx.client.update({
        where: { id: clientId },
        data: {
          loyaltyPoints: { increment: pointsEarned },
        },
      });

      return movement;
    });

    return result;
  }

  /**
   * Retrieves the loyalty movement history for a specific client.
   * @param clientId The ID of the client.
   * @returns A list of loyalty movements.
   */
  async getClientLoyaltyHistory(clientId: string) {
    return this.prisma.loyaltyMovement.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }

  /**
   * Performs a manual adjustment of loyalty points for a client.
   * @param clientId The ID of the client.
   * @param amount The amount of points to add (positive) or remove (negative).
   * @param notes Rationale for the adjustment.
   * @returns The created loyalty movement.
   */
  async adjustPoints(clientId: string, amount: number, notes: string) {
    const type = amount >= 0 ? 'ADJUSTMENT' : 'REDEEMED';

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.loyaltyMovement.create({
        data: {
          clientId,
          amount,
          type: type as any,
          notes,
        },
      });

      await tx.client.update({
        where: { id: clientId },
        data: {
          loyaltyPoints: { increment: amount },
        },
      });

      return movement;
    });
  }

  /**
   * Retrieves the top loyalty earners.
   * @param limit The maximum number of earners to retrieve. Defaults to 10.
   * @returns A list of top earners.
   */
  async getTopEarners(limit = 10) {
    return this.prisma.client.findMany({
      where: { active: true, loyaltyPoints: { gt: 0 } },
      orderBy: { loyaltyPoints: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
      },
    });
  }
  /**
   * --- CAMPAIGNS AND TEMPLATES ---
   */

  /**
   * Retrieves all message templates.
   * @returns A list of message templates.
   */
  async getTemplates() {
    return this.prisma.messageTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creates a new message template.
   * @param data The template data.
   * @returns The created message template.
   */
  async createTemplate(data: { name: string; content: string; category?: string }) {
    return this.prisma.messageTemplate.create({
      data: {
        name: data.name,
        content: data.content,
        category: data.category || 'GENERAL',
      },
    });
  }

  /**
   * Deletes a message template.
   * @param id The ID of the template to delete.
   * @returns The deleted message template.
   */
  async deleteTemplate(id: string) {
    return this.prisma.messageTemplate.delete({
      where: { id },
    });
  }

  /**
   * Retrieves all marketing campaigns.
   * @returns A list of campaigns with template details.
   */
  async getCampaigns() {
    return this.prisma.campaign.findMany({
      include: {
        template: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves detailed information about a specific campaign, including recipients.
   * @param campaignId The ID of the campaign.
   * @returns Detailed campaign information.
   */
  async getCampaignDetails(campaignId: string) {
    return this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        recipients: {
          orderBy: { clientName: 'asc' },
        },
      },
    });
  }

  /**
   * Creates a new marketing campaign and identifies recipients based on the target segment.
   * @param data Campaign creation data including name, template, and segment.
   * @returns The created campaign.
   */
  async createCampaign(data: { name: string; templateId: string; targetSegment: string }) {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { id: data.templateId },
    });

    if (!template) throw new Error('Template not found');

    // 1. Get the clients based on the segment
    let selectedClients: any[] = [];
    const config = await this.getConfig();
    if (!config) throw new Error('Marketing config missing');

    const allClients = await this.prisma.client.findMany({
      where: { active: true, phone: { not: null } },
      include: {
        sales: {
          where: { active: true },
          select: { total: true, exchangeRate: true, date: true },
        },
      },
    });

    const now = dayjs();
    const churnDate = now.subtract(config.churnDays, 'day').toDate();

    allClients.forEach(client => {
      let includeClient = false;
      const totalSpentUSD = this.calculateTotalSpentUSD(client.sales as any[]);
      const clientTier = this.calculateClientTier(totalSpentUSD, config);

      if (data.targetSegment === 'ALL') {
        includeClient = true;
      } else if (data.targetSegment === 'VIP' && clientTier === ClientTier.VIP) {
        includeClient = true;
      } else if (data.targetSegment === 'GOLD' && clientTier === ClientTier.GOLD) {
        includeClient = true;
      } else if (data.targetSegment === 'SILVER' && clientTier === ClientTier.SILVER) {
        includeClient = true;
      } else if (data.targetSegment === 'CHURN') {
        const lastSale = client.sales.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
        if (lastSale && dayjs(lastSale.date).isBefore(churnDate)) {
          includeClient = true;
        }
      } else if (data.targetSegment === 'BIRTHDAY') {
        if (client.birthDate && dayjs(client.birthDate).month() === now.month()) {
          includeClient = true;
        }
      }

      if (includeClient && client.phone && client.phone.trim() !== '') {
        // Prepare personalized message
        let msg = template.content;
        msg = msg.replace(/{nombre}/g, client.name);
        msg = msg.replace(/{tier}/g, clientTier);
        msg = msg.replace(/{puntos}/g, client.loyaltyPoints?.toString() || '0');

        selectedClients.push({
          clientId: client.id,
          clientName: client.name,
          clientPhone: client.phone,
          message: msg,
        });
      }
    });

    if (selectedClients.length === 0) {
      throw new Error('No clients found for this segment with a valid phone number.');
    }

    // 2. Create the campaign and recipients
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          name: data.name,
          templateId: data.templateId,
          targetSegment: data.targetSegment,
          totalRecipients: selectedClients.length,
          status: 'PENDING',
        },
      });

      await tx.campaignRecipient.createMany({
        data: selectedClients.map(c => ({
          ...c,
          campaignId: campaign.id,
        })),
      });

      return campaign;
    });
  }

  /**
   * Marks a campaign recipient as sent and updates the campaign status if necessary.
   * @param recipientId The ID of the recipient.
   * @returns The updated recipient record.
   */
  async markRecipientSent(recipientId: string) {
    const recipient = await this.prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
      include: {
        campaign: true,
      },
    });

    // Update campaign counter
    await this.prisma.campaign.update({
      where: { id: recipient.campaignId },
      data: {
        sentCount: { increment: 1 },
      },
    });

    // If all sent, update campaign status
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: recipient.campaignId },
      include: {
        _count: {
          select: { recipients: { where: { status: 'SENT' } } },
        },
      },
    });

    if (campaign && campaign._count.recipients >= campaign.totalRecipients) {
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED' },
      });
    }

    return recipient;
  }

  // ==========================================
  // COUPONS MANAGEMENT
  // ==========================================

  /**
   * Creates a new discount coupon.
   * @param data Coupon creation data.
   * @returns The created coupon.
   */
  async createCoupon(data: any) {
    return this.prisma.coupon.create({ data });
  }

  /**
   * Retrieves all discount coupons.
   * @returns A list of coupons.
   */
  async getCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Updates an existing discount coupon.
   * @param id The ID of the coupon to update.
   * @param data The partial coupon data.
   * @returns The updated coupon.
   */
  async updateCoupon(id: string, data: any) {
    return this.prisma.coupon.update({ where: { id }, data });
  }

  /**
   * Deletes a discount coupon.
   * @param id The ID of the coupon to delete.
   * @returns The deleted coupon.
   */
  async deleteCoupon(id: string) {
    return this.prisma.coupon.delete({ where: { id } });
  }

  /**
   * Validates a coupon code against a cart and client.
   * @param code The coupon code to validate.
   * @param payload Validation data including clientId and cartItems.
   * @returns Validation result including discount amount.
   */
  async validateCoupon(code: string, payload: { clientId?: string, cartItems: any[] }) {
    const { clientId, cartItems = [] } = payload;
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) throw new Error('Invalid or non-existent coupon');
    if (!coupon.isActive) throw new Error('Inactive coupon');

    // Dates
    const now = dayjs();
    if (coupon.startDate && now.isBefore(dayjs(coupon.startDate))) throw new Error('Coupon is not yet valid');
    if (coupon.endDate && now.isAfter(dayjs(coupon.endDate))) throw new Error('Coupon has expired');

    // Global usage limits
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new Error('Usage limit reached for this coupon');
    }

    // Client Tier
    if (coupon.targetTiers && coupon.targetTiers.length > 0) {
      if (!clientId) throw new Error('This coupon requires a registered client');
      
      const config = await this.getConfig();
      if (!config) throw new Error('Marketing configuration not found');
      
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
        include: { sales: { where: { active: true }, select: { total: true, exchangeRate: true } } }
      });
      if (!client) throw new Error('Client does not exist');

      const totalSpentUSD = this.calculateTotalSpentUSD(client.sales as any[]);
      const clientTier = this.calculateClientTier(totalSpentUSD, config);

      if (!coupon.targetTiers.includes(clientTier)) {
        throw new Error(`This coupon is exclusive for tier levels: ${coupon.targetTiers.join(', ')}. Your level is ${clientTier}.`);
      }
    }

    // Single use
    if (coupon.isSingleUsePerClient) {
      if (!clientId) throw new Error('Single-use coupon requires a registered client');
      const pastUsage = await this.prisma.sale.findFirst({
        where: { clientId, couponId: coupon.id, active: true }
      });
      if (pastUsage) throw new Error('You have already used this coupon.');
    }

    // Check cart items rules
    let applicableSubtotal = 0;
    const applicableItems: any[] = [];

    for (const item of cartItems) {
      // verify if it passes department/product checks
      let applies = true;
      if (coupon.applicableDepartments.length > 0 && item.categoryId) {
         if (!coupon.applicableDepartments.includes(item.categoryId)) {
           applies = false;
         }
      }
      if (coupon.applicableProducts.length > 0 && item.id) {
         if (!coupon.applicableProducts.includes(item.id)) {
           applies = false;
         }
      }

      if (applies) {
        applicableSubtotal += Number(item.salePrice) * Number(item.quantity);
        applicableItems.push(item);
      }
    }

    if (applicableSubtotal === 0 || applicableItems.length === 0) {
       throw new Error('The coupon does not apply to any product in your cart. Check restrictions (allowed departments or products).');
    }

    // Min purchase
    if (coupon.minPurchaseAmount && applicableSubtotal < Number(coupon.minPurchaseAmount)) {
       throw new Error(`This coupon requires a minimum purchase of $${coupon.minPurchaseAmount} in applicable items`);
    }

    // Calculate discount
    let totalDiscount = 0;
    
    if (coupon.discountType === 'PERCENTAGE') {
       const percentage = Number(coupon.discountValue) / 100;
       // We must apply line by line to respect cost
       for (const item of applicableItems) {
         const itemTotalSales = Number(item.salePrice) * Number(item.quantity);
         const itemTotalCost = Number(item.costPrice || 0) * Number(item.quantity);
         let potentialDiscount = itemTotalSales * percentage;

         // Cost protection
         if (itemTotalSales - potentialDiscount < itemTotalCost) {
            potentialDiscount = itemTotalSales - itemTotalCost;
            if (potentialDiscount < 0) potentialDiscount = 0;
         }

         totalDiscount += potentialDiscount;
       }
    } else {
       // Fixed amount. We split the fixed amount proportionally and limit by cost
       let remainingDiscount = Number(coupon.discountValue);
       
       for (const item of applicableItems) {
          if (remainingDiscount <= 0) break;

          const itemTotalSales = Number(item.salePrice) * Number(item.quantity);
          const itemTotalCost = Number(item.costPrice || 0) * Number(item.quantity);
          const margin = itemTotalSales - itemTotalCost;

          if (margin > 0) {
            const applicableHere = Math.min(margin, remainingDiscount);
            totalDiscount += applicableHere;
            remainingDiscount -= applicableHere;
          }
       }
    }

    if (totalDiscount <= 0) {
      throw new Error('The coupon is valid but cannot be applied because the products are already at cost or leave no margin.');
    }

    // round to 2 decimals
    totalDiscount = Math.round(totalDiscount * 100) / 100;

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountAmount: totalDiscount,
      message: `Coupon ${coupon.code} applied successfully! Discount: -${totalDiscount}`
    };
  }

  /**
   * --- REDEMPTION LOGIC ---
   */

  /**
   * Redeems loyalty points for a sale.
   * @param clientId The ID of the client.
   * @param saleId The ID of the sale (optional).
   * @param pointsToRedeem The number of points to redeem.
   * @param notes Rationale for the redemption.
   * @returns The created loyalty movement.
   */
  async redeemPoints(clientId: string, saleId: string | null, pointsToRedeem: number, notes?: string) {
    return this.prisma.$transaction(async (tx) => {
      return this.redeemPointsWithTx(tx, clientId, saleId, pointsToRedeem, notes);
    });
  }

  /**
   * Internal redemption logic that can be used within an existing transaction.
   * @param tx The transaction context.
   * @param clientId The ID of the client.
   * @param saleId The ID of the sale (optional).
   * @param pointsToRedeem The number of points to redeem.
   * @param notes Rationale for the redemption.
   * @returns The created loyalty movement.
   */
  async redeemPointsWithTx(tx: any, clientId: string, saleId: string | null, pointsToRedeem: number, notes?: string) {
    if (pointsToRedeem <= 0) return null;

    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { loyaltyPoints: true }
    });

    if (!client) throw new Error('Client not found');
    
    // Convert to number for comparison as Prisma Decimal might behave differently
    const currentPoints = Number(client.loyaltyPoints);
    if (currentPoints < pointsToRedeem) {
      throw new Error(`Insufficient points balance. The client only has ${currentPoints} points available, but an attempt was made to redeem ${pointsToRedeem}.`);
    }

    const movement = await tx.loyaltyMovement.create({
      data: {
        clientId,
        saleId,
        amount: pointsToRedeem,
        type: 'REDEEMED',
        notes: notes || `Redemption of points in sale`,
      },
    });

    await tx.client.update({
      where: { id: clientId },
      data: {
        loyaltyPoints: { decrement: pointsToRedeem },
      },
    });

    return movement;
  }

  /**
   * Retrieves the redemption value information for a client.
   * @param clientId The ID of the client.
   * @returns Points balance, value in USD, and max redemption percentage.
   */
  async getRedemptionValue(clientId: string) {
    const config = await this.getConfig();
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { loyaltyPoints: true }
    });

    if (!config || !client) return { points: 0, valueUsd: 0 };

    return {
      points: Number(client.loyaltyPoints),
      valueUsd: Number(client.loyaltyPoints) * Number(config.valuePerPoint),
      rate: Number(config.valuePerPoint),
      maxRedemptionPercentage: config.maxRedemptionPercentage
    };
  }

  // --- SOCIAL HUB ---

  /**
   * Generates a social media post draft using AI based on a product.
   * @param productId The ID of the product.
   * @param platform The target social media platform.
   * @param instructions Optional custom instructions for the AI.
   * @returns The created social post draft.
   */
  async generateSocialPost(productId: string, platform: string, instructions?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        currency: true
      }
    });

    if (!product) throw new Error('Product not found');

    const content = await this.aiService.generateSocialPost({
      product,
      platform,
      customInstructions: instructions
    });

    // Save as draft automatically
    return this.prisma.socialPost.create({
      data: {
        platform,
        content,
        productId,
        status: 'DRAFT'
      }
    });
  }

  /**
   * Retrieves all social post drafts.
   * @returns A list of social post drafts.
   */
  async getSocialDrafts() {
    return this.prisma.socialPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  /**
   * Deletes a social post draft.
   * @param id The ID of the draft to delete.
   * @returns The deleted draft.
   */
  async deleteSocialDraft(id: string) {
    return this.prisma.socialPost.delete({ where: { id } });
  }

  /**
   * Calculates the total amount spent by a client in USD.
   * @param sales List of sales associated with the client.
   * @returns Total spent in USD.
   */
  private calculateTotalSpentUSD(sales: any[]): number {
    return sales.reduce((acc, sale) => {
      const rate = Number(sale.exchangeRate) || 1;
      return acc + (Number(sale.total) / rate);
    }, 0);
  }

  /**
   * Determines the client tier based on total spending and configuration.
   * @param totalSpentUSD Total spent by the client in USD.
   * @param config The marketing configuration thresholds.
   * @returns The assigned ClientTier.
   */
  private calculateClientTier(totalSpentUSD: number, config: MarketingConfig): ClientTier {
    if (totalSpentUSD >= Number(config.tierVipThreshold)) return ClientTier.VIP;
    if (totalSpentUSD >= Number(config.tierGoldThreshold)) return ClientTier.GOLD;
    if (totalSpentUSD >= Number(config.tierSilverThreshold)) return ClientTier.SILVER;
    return ClientTier.BRONZE;
  }
}

