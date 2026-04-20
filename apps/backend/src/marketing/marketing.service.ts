import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

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

  async getConfig() {
    return this.prisma.marketingConfig.findFirst();
  }

  async updateConfig(data: any) {
    const config = await this.getConfig();
    if (!config) throw new Error('Marketing configuration not initialized');
    
    return this.prisma.marketingConfig.update({
      where: { id: config.id },
      data,
    });
  }

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
      // Calculate total spent (approximated to a base currency, e.g. USD)
      // We assume exchangeRate is available in the sale (VES/USD)
      const totalSpentUSD = client.sales.reduce((acc, sale) => {
        const rate = Number(sale.exchangeRate) || 1;
        return acc + (Number(sale.total) / rate);
      }, 0);

      if (totalSpentUSD >= Number(config.tierVipThreshold)) tiers.vip++;
      else if (totalSpentUSD >= Number(config.tierGoldThreshold)) tiers.gold++;
      else if (totalSpentUSD >= Number(config.tierSilverThreshold)) tiers.silver++;
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
   * Earn loyalty points for a sale (called from SalesService)
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
          notes: `Puntos ganados por venta`,
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
   * Get loyalty movements for a specific client
   */
  async getClientLoyaltyHistory(clientId: string) {
    return this.prisma.loyaltyMovement.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }

  /**
   * Manual adjustment of points (admin)
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
   * Top loyalty earners for the dashboard
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

  async getTemplates() {
    return this.prisma.messageTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(data: { name: string; content: string; category?: string }) {
    return this.prisma.messageTemplate.create({
      data: {
        name: data.name,
        content: data.content,
        category: data.category || 'GENERAL',
      },
    });
  }

  async deleteTemplate(id: string) {
    return this.prisma.messageTemplate.delete({
      where: { id },
    });
  }

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
      let clientTier = 'Bronce'; // Default

      const totalSpentUSD = client.sales.reduce((acc, sale) => {
        const rate = Number(sale.exchangeRate) || 1;
        return acc + (Number(sale.total) / rate);
      }, 0);

      if (totalSpentUSD >= Number(config.tierVipThreshold)) clientTier = 'VIP';
      else if (totalSpentUSD >= Number(config.tierGoldThreshold)) clientTier = 'Oro';
      else if (totalSpentUSD >= Number(config.tierSilverThreshold)) clientTier = 'Plata';

      if (data.targetSegment === 'ALL') {
        includeClient = true;
      } else if (data.targetSegment === 'VIP' && clientTier === 'VIP') {
        includeClient = true;
      } else if (data.targetSegment === 'GOLD' && clientTier === 'Oro') {
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

  async createCoupon(data: any) {
    return this.prisma.coupon.create({ data });
  }

  async getCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateCoupon(id: string, data: any) {
    return this.prisma.coupon.update({ where: { id }, data });
  }

  async deleteCoupon(id: string) {
    return this.prisma.coupon.delete({ where: { id } });
  }

  async validateCoupon(code: string, payload: { clientId?: string, cartItems: any[] }) {
    const { clientId, cartItems = [] } = payload;
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) throw new Error('Cupón inválido o no existe');
    if (!coupon.isActive) throw new Error('Cupón inactivo');

    // Fechas
    const now = dayjs();
    if (coupon.startDate && now.isBefore(dayjs(coupon.startDate))) throw new Error('El cupón aún no es válido');
    if (coupon.endDate && now.isAfter(dayjs(coupon.endDate))) throw new Error('El cupón ha expirado');

    // Límites de uso global
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new Error('Límite de usos alcanzado para este cupón');
    }

    // Cliente Tier
    if (coupon.targetTiers && coupon.targetTiers.length > 0) {
      if (!clientId) throw new Error('Este cupón requiere que seas un cliente registrado');
      
      const config = await this.getConfig();
      
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
        include: { sales: { where: { active: true }, select: { total: true, exchangeRate: true } } }
      });
      if (!client) throw new Error('Cliente no existe');

      const totalSpentUSD = client.sales.reduce((acc, sale) => {
        const rate = Number(sale.exchangeRate) || 1;
        return acc + (Number(sale.total) / rate);
      }, 0);

      let clientTier = 'BRONZE';
      if (totalSpentUSD >= Number(config?.tierVipThreshold || 1000)) clientTier = 'VIP';
      else if (totalSpentUSD >= Number(config?.tierGoldThreshold || 500)) clientTier = 'GOLD';
      else if (totalSpentUSD >= Number(config?.tierSilverThreshold || 200)) clientTier = 'SILVER';

      if (!coupon.targetTiers.includes(clientTier)) {
        throw new Error(`Este cupón es exclusivo para clientes nivel: ${coupon.targetTiers.join(', ')}. Tu nivel es ${clientTier}.`);
      }
    }

    // Single use
    if (coupon.isSingleUsePerClient) {
      if (!clientId) throw new Error('Cupón de un solo uso requiere cliente registrado');
      const pastUsage = await this.prisma.sale.findFirst({
        where: { clientId, couponId: coupon.id, active: true }
      });
      if (pastUsage) throw new Error('Ya has utilizado este cupón anteriormente.');
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
       throw new Error('El cupón no aplica a ningún producto en tu carrito. Revisa las restricciones (departamentos o productos permitidos).');
    }

    // Min purchase
    if (coupon.minPurchaseAmount && applicableSubtotal < Number(coupon.minPurchaseAmount)) {
       throw new Error(`Este cupón requiere una compra mínima de $${coupon.minPurchaseAmount} en artículos aplicables`);
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
      throw new Error('El cupón es válido pero no puede aplicarse porque los productos ya están al costo o no dejan margen.');
    }

    // round to 2 decimals
    totalDiscount = Math.round(totalDiscount * 100) / 100;

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountAmount: totalDiscount,
      message: `¡Cupón ${coupon.code} aplicado con éxito! Descuento: -${totalDiscount}`
    };
  }

  /**
   * --- REDEMPTION LOGIC ---
   */

  /**
   * Redeem loyalty points for a sale
   */
  async redeemPoints(clientId: string, saleId: string | null, pointsToRedeem: number, notes?: string) {
    return this.prisma.$transaction(async (tx) => {
      return this.redeemPointsWithTx(tx, clientId, saleId, pointsToRedeem, notes);
    });
  }

  /**
   * Internal redeem logic that can be used within an existing transaction
   */
  async redeemPointsWithTx(tx: any, clientId: string, saleId: string | null, pointsToRedeem: number, notes?: string) {
    if (pointsToRedeem <= 0) return null;

    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { loyaltyPoints: true }
    });

    if (!client) throw new Error('Cliente no encontrado');
    
    // Convert to number for comparison as Prisma Decimal might behave differently
    const currentPoints = Number(client.loyaltyPoints);
    if (currentPoints < pointsToRedeem) {
      throw new Error(`Saldo de puntos insuficiente. El cliente solo tiene ${currentPoints} puntos disponibles, pero se intentó canjear ${pointsToRedeem}.`);
    }

    const movement = await tx.loyaltyMovement.create({
      data: {
        clientId,
        saleId,
        amount: pointsToRedeem,
        type: 'REDEEMED',
        notes: notes || `Canje de puntos en venta`,
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
   * Get point value information for a client
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

  async generateSocialPost(productId: string, platform: string, instructions?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        currency: true
      }
    });

    if (!product) throw new Error('Producto no encontrado');

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

  async getSocialDrafts() {
    return this.prisma.socialPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  async deleteSocialDraft(id: string) {
    return this.prisma.socialPost.delete({ where: { id } });
  }
}

