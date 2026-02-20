import { Injectable, Logger, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class MercadoLibreService {
  private readonly logger = new Logger(MercadoLibreService.name);
  private readonly mlApiUrl = 'https://api.mercadolibre.com';

  constructor(private readonly prisma: PrismaService) { }

  // ─── OAuth ──────────────────────────────────────────────

  getAuthUrl(): string {
    const clientId = process.env.ML_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.ML_REDIRECT_URI || '');
    return `https://auth.mercadolibre.com/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
  }

  async handleCallback(code: string) {
    try {
      const response = await axios.post(`${this.mlApiUrl}/oauth/token`, {
        grant_type: 'authorization_code',
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        code,
        redirect_uri: process.env.ML_REDIRECT_URI,
      });

      const { access_token, refresh_token, expires_in, user_id, scope, token_type } = response.data;

      // Fetch username from ML profile
      let username: string | null = null;
      try {
        const profile = await axios.get(`${this.mlApiUrl}/users/${user_id}`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        username = profile.data.nickname || null;
      } catch {
        this.logger.warn('Could not fetch ML username');
      }

      return await this.prisma.mercadoLibreAccount.upsert({
        where: { mlUserId: user_id.toString() },
        update: {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresIn: expires_in,
          scope,
          tokenType: token_type,
          username,
        },
        create: {
          mlUserId: user_id.toString(),
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresIn: expires_in,
          scope,
          tokenType: token_type,
          username,
        },
      });
    } catch (error: any) {
      this.logger.error('Error in ML callback', error.response?.data || error.message);
      throw new HttpException('Failed to authenticate with Mercado Libre', HttpStatus.BAD_GATEWAY);
    }
  }

  // ─── Token Refresh ──────────────────────────────────────

  private async refreshToken(accountId: string): Promise<string> {
    const account = await this.prisma.mercadoLibreAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('ML account not found');

    try {
      const response = await axios.post(`${this.mlApiUrl}/oauth/token`, {
        grant_type: 'refresh_token',
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        refresh_token: account.refreshToken,
      });

      const { access_token, refresh_token, expires_in } = response.data;

      await this.prisma.mercadoLibreAccount.update({
        where: { id: accountId },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresIn: expires_in,
        },
      });

      return access_token;
    } catch (error: any) {
      this.logger.error('Failed to refresh ML token', error.response?.data || error.message);
      throw new HttpException('ML token refresh failed – re-authorize the account', HttpStatus.UNAUTHORIZED);
    }
  }

  private async getValidToken(accountId: string): Promise<string> {
    const account = await this.prisma.mercadoLibreAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('ML account not found');

    // Check if token is about to expire (within 5 minutes)
    const updatedAt = new Date(account.updatedAt).getTime();
    const expiresAt = updatedAt + account.expiresIn * 1000;
    const fiveMinutes = 5 * 60 * 1000;

    if (Date.now() > expiresAt - fiveMinutes) {
      return this.refreshToken(accountId);
    }

    return account.accessToken;
  }

  // ─── Accounts ───────────────────────────────────────────

  async getAccounts() {
    return this.prisma.mercadoLibreAccount.findMany({
      select: {
        id: true,
        mlUserId: true,
        username: true,
        updatedAt: true,
        _count: { select: { productMappings: true } },
      },
    });
  }

  async deleteAccount(accountId: string) {
    // First remove all mappings
    await this.prisma.mercadoLibreProductMapping.deleteMany({ where: { mlAccountId: accountId } });
    return this.prisma.mercadoLibreAccount.delete({ where: { id: accountId } });
  }

  // ─── Product Publishing ─────────────────────────────────

  async getCategories(parentId?: string) {
    const url = parentId
      ? `https://api.mercadolibre.com/categories/${parentId}`
      : `https://api.mercadolibre.com/sites/MLV/categories`; // Hardcoded to MLV (Venezuela) for now

    try {
      const response = await axios.get(url);
      if (parentId) {
        return response.data.children_categories || [];
      }
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch ML categories', error.message);
      return [];
    }
  }

  async publishProduct(productId: string, mlAccountId: string, overrides: any = {}) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { currency: true, category: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Check if already mapped
    const existing = await this.prisma.mercadoLibreProductMapping.findUnique({
      where: { productId },
    });
    if (existing) {
      throw new HttpException('Product is already published on Mercado Libre', HttpStatus.CONFLICT);
    }

    const token = await this.getValidToken(mlAccountId);
    const account = await this.prisma.mercadoLibreAccount.findUnique({ where: { id: mlAccountId } });

    // Build ML item payload with overrides
    const mlItem = {
      title: (overrides.title || product.name).substring(0, 60),
      category_id: overrides.categoryId || 'MLV1055',
      price: Number(overrides.price || product.salePrice),
      currency_id: product.currency?.code === 'USD' ? 'USD' : 'VES',
      available_quantity: Math.max(0, Math.floor(Number(overrides.availableQuantity !== undefined ? overrides.availableQuantity : product.stock))),
      buying_mode: 'buy_it_now',
      condition: 'new',
      listing_type_id: overrides.listingTypeId || 'gold_special',
      description: { plain_text: overrides.description || product.description || product.name },
      pictures: overrides.images && overrides.images.length > 0
        ? overrides.images.map(img => ({ source: img }))
        : product.images.map(img => ({ source: img })),
    };

    // --- Handling Mock Account ---
    if (token === 'mock_access_token') {
      this.logger.log(`Simulating publication for MOCK account: ${account?.username}`);
      const mockMlItemId = `MLV${Math.floor(Math.random() * 1000000000)}`;
      return await this.prisma.mercadoLibreProductMapping.create({
        data: {
          productId,
          mlItemId: mockMlItemId,
          mlPermalink: `https://articulo.mercadolibre.com.ve/${mockMlItemId}-item-de-prueba`,
          mlAccountId,
          syncStatus: 'SUCCESS',
          lastSync: new Date(),
        },
      });
    }

    try {
      const response = await axios.post(`${this.mlApiUrl}/items`, mlItem, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      const { id: mlItemId, permalink } = response.data;

      // Save mapping
      return await this.prisma.mercadoLibreProductMapping.create({
        data: {
          productId,
          mlItemId,
          mlPermalink: permalink,
          mlAccountId,
          syncStatus: 'SUCCESS',
          lastSync: new Date(),
        },
      });
    } catch (error: any) {
      this.logger.error('Failed to publish to ML', error.response?.data || error.message);
      throw new HttpException(
        error.response?.data?.message || 'Failed to publish product on Mercado Libre',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ─── Sync (update price/stock) ──────────────────────────

  async syncProduct(productId: string) {
    const mapping = await this.prisma.mercadoLibreProductMapping.findUnique({
      where: { productId },
      include: { product: true, mlAccount: true },
    });
    if (!mapping) throw new NotFoundException('Product mapping not found');

    const token = await this.getValidToken(mapping.mlAccountId);

    // --- Handling Mock Account ---
    if (token === 'mock_access_token') {
      this.logger.log(`Simulating sync for MOCK account: ${mapping.mlAccount.username}`);
      return await this.prisma.mercadoLibreProductMapping.update({
        where: { id: mapping.id },
        data: { syncStatus: 'SUCCESS', lastSync: new Date(), syncError: null },
      });
    }

    const updatePayload = {
      price: Number(mapping.product.salePrice),
      available_quantity: Math.max(0, Math.floor(Number(mapping.product.stock))),
    };

    try {
      await axios.put(`${this.mlApiUrl}/items/${mapping.mlItemId}`, updatePayload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return await this.prisma.mercadoLibreProductMapping.update({
        where: { id: mapping.id },
        data: { syncStatus: 'SUCCESS', lastSync: new Date(), syncError: null },
      });
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      await this.prisma.mercadoLibreProductMapping.update({
        where: { id: mapping.id },
        data: { syncStatus: 'FAILED', syncError: errorMsg },
      });
      throw new HttpException(`Sync failed: ${errorMsg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  // ─── Unpublish ──────────────────────────────────────────

  async unpublishProduct(productId: string) {
    const mapping = await this.prisma.mercadoLibreProductMapping.findUnique({
      where: { productId },
    });
    if (!mapping) throw new NotFoundException('Product mapping not found');

    const token = await this.getValidToken(mapping.mlAccountId);

    // --- Handling Mock Account ---
    if (token === 'mock_access_token') {
      this.logger.log(`Simulating unpublish for MOCK account`);
      return this.prisma.mercadoLibreProductMapping.delete({ where: { id: mapping.id } });
    }

    try {
      // Close the listing on ML
      await axios.put(
        `${this.mlApiUrl}/items/${mapping.mlItemId}`,
        { status: 'closed' },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (error: any) {
      this.logger.warn('Could not close ML listing', error.response?.data || error.message);
    }

    // Remove local mapping
    return this.prisma.mercadoLibreProductMapping.delete({ where: { id: mapping.id } });
  }

  // ─── Pause Listing ──────────────────────────────────────

  async pauseProduct(productId: string) {
    const mapping = await this.prisma.mercadoLibreProductMapping.findUnique({
      where: { productId },
      include: { mlAccount: true },
    });
    if (!mapping) throw new NotFoundException('Product mapping not found');

    const token = await this.getValidToken(mapping.mlAccountId);

    // --- Handling Mock Account ---
    if (token === 'mock_access_token') {
      this.logger.log(`Simulating pause for MOCK account: ${mapping.mlAccount.username}`);
      return await this.prisma.mercadoLibreProductMapping.update({
        where: { id: mapping.id },
        data: { syncStatus: 'SUCCESS', lastSync: new Date() },
      });
    }

    try {
      await axios.put(
        `${this.mlApiUrl}/items/${mapping.mlItemId}`,
        { status: 'paused' },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return await this.prisma.mercadoLibreProductMapping.update({
        where: { id: mapping.id },
        data: { syncStatus: 'SUCCESS', lastSync: new Date() },
      });
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      this.logger.error(`Pause failed: ${errorMsg}`);
      throw new HttpException(`Pause failed: ${errorMsg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  // ─── Auto-Sync Stock (triggered by sales) ───────────────

  async syncProductStock(productId: string) {
    const mapping = await this.prisma.mercadoLibreProductMapping.findUnique({
      where: { productId },
      include: { product: true },
    });
    if (!mapping) return; // Silent if not mapped

    const token = await this.getValidToken(mapping.mlAccountId);

    // --- Handling Mock Account ---
    if (token === 'mock_access_token') {
      this.logger.log(`[Auto-Sync] Simulating stock sync for product ${productId}`);
      await this.prisma.mercadoLibreProductMapping.update({
        where: { id: mapping.id },
        data: { lastSync: new Date() },
      });
      return;
    }

    try {
      // Just update stock
      await axios.put(
        `${this.mlApiUrl}/items/${mapping.mlItemId}`,
        { available_quantity: Math.max(0, Math.floor(Number(mapping.product.stock))) },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      await this.prisma.mercadoLibreProductMapping.update({
        where: { id: mapping.id },
        data: { syncStatus: 'SUCCESS', lastSync: new Date(), syncError: null },
      });
    } catch (error: any) {
      this.logger.warn(`Auto-sync failed for ${productId}: ${error.message}`);
      await this.prisma.mercadoLibreProductMapping.update({
        where: { id: mapping.id },
        data: { syncStatus: 'FAILED', syncError: 'Auto-sync failed: ' + error.message },
      });
    }
  }

  // ─── List Mappings ──────────────────────────────────────

  async getMappings(mlAccountId?: string) {
    return this.prisma.mercadoLibreProductMapping.findMany({
      where: mlAccountId ? { mlAccountId } : undefined,
      include: {
        product: { select: { id: true, name: true, sku: true, salePrice: true, stock: true, images: true } },
        mlAccount: { select: { id: true, username: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createMockAccount() {
    const mockUserId = `TEST_${Math.floor(Math.random() * 1000000)}`;
    return this.prisma.mercadoLibreAccount.create({
      data: {
        mlUserId: mockUserId,
        username: 'USUARIO_DE_PRUEBA',
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresIn: 21600,
      },
    });
  }
}
