import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import axios from 'axios';
import * as bwipjs from 'bwip-js';

export interface CatalogProduct {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category: { name: string };
  department: { name: string };
  salePrice: number;
  offerPrice: number | null;
  wholesalePrice: number | null;
  currencySymbol: string;
  stock: number;
  imageUrl: string | null;
  priceInTarget: number;
  roundedPrice: number;
}

export interface CatalogParams {
  currencyCode: string;
  formatCurrency: (value: number) => string;
  categoryIds?: string[];
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calculates the cross-rate factor between target currency and the primary/reference currency.
   * Mirrors the same logic as the POS and Stats modules for consistency.
   */
  private async getCrossRateFactor(
    targetCurrencyCode: string,
  ): Promise<number> {
    const settings = await this.prisma.companySettings.findFirst({
      include: { preferredSecondaryCurrency: true },
    });
    const refCurrency = settings?.preferredSecondaryCurrency;
    const refRate = Number(refCurrency?.exchangeRate || 1);

    if (targetCurrencyCode === 'VES') {
      return refRate;
    }

    const targetCurrency = await this.prisma.currency.findUnique({
      where: { code: targetCurrencyCode },
    });

    if (!targetCurrency || !refCurrency) return 1;
    if (targetCurrency.code === refCurrency.code) return 1;

    const tr = Number(targetCurrency.exchangeRate || 1);
    return tr > 0 ? refRate / tr : 1;
  }

  /**
   * Applies rounding exactly like the POS does: Math.ceil(price / factor) * factor
   */
  private applyRounding(
    price: number,
    roundingEnabled: boolean,
    roundingFactor: number,
  ): number {
    if (!roundingEnabled || roundingFactor <= 1) return price;
    return Math.ceil(price / roundingFactor) * roundingFactor;
  }

  /**
   * Formats a number as a Venezuelan-formatted string with currency (e.g., "31.395,00 Bs")
   */
  formatVenezuelanPrice(
    value: number,
    currencySymbol: string = 'Bs',
    decimals: number = 0,
  ): string {
    if (value === null || value === undefined || isNaN(Number(value)))
      return `${currencySymbol} 0`;

    // After rounding to factor (e.g. 10), decimals are usually 0
    const numValue = Number(value);
    const fixed = numValue.toFixed(decimals);
    const parts = fixed.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decimalPart = parts[1];
    return decimalPart
      ? `${integerPart},${decimalPart} ${currencySymbol}`
      : `${integerPart} ${currencySymbol}`;
  }

  /**
   * Generates the catalog PDF as a Buffer.
   * @param params Target currency code and formatter
   * @returns Buffer with the PDF content
   */
  async generateCatalogPdf(params: CatalogParams): Promise<Buffer> {
    const categoryFilter = params.categoryIds?.length
      ? { categoryId: { in: params.categoryIds } }
      : {};

    const [settings, products, allCurrencies] = await Promise.all([
      this.prisma.companySettings.findFirst(),
      this.prisma.product.findMany({
        where: { active: true, ...categoryFilter },
        include: {
          category: { select: { name: true } },
        },
        orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.currency.findMany({ where: { active: true } }),
    ]);

    const companyName = settings?.name || 'MastERP';
    const companyRif = settings?.rif || '';

    const targetCurrency = allCurrencies.find(
      (c) => c.code === params.currencyCode,
    );
    const targetRate = targetCurrency
      ? Number(targetCurrency.exchangeRate || 1)
      : 1;
    const targetSymbol = targetCurrency?.symbol || 'Bs';

    const isPrimaryCurrency = targetCurrency?.isPrimary ?? false;
    const roundingEnabled =
      isPrimaryCurrency && (settings?.roundingEnabled ?? true);
    const roundingFactor = settings?.roundingFactor ?? 10;

    // Attach logoUrl to settings for the PDF
    settings?.logoUrl;

    // ── Prepare data + download images BEFORE creating the PDF stream ──
    const catalogProducts = products.map((p: any) => {
      let priceInVes: number;
      if (p.currencyId === targetCurrency?.id) {
        priceInVes = Number(p.salePrice);
      } else {
        const productCurrency = allCurrencies.find(
          (c) => c.id === p.currencyId,
        );
        const productRate = productCurrency
          ? Number(productCurrency.exchangeRate || 1)
          : 1;
        priceInVes = Number(p.salePrice) * productRate;
      }

      const priceInTarget = priceInVes / targetRate;
      const roundedPrice = this.applyRounding(
        priceInTarget,
        roundingEnabled,
        roundingFactor,
      );

      const productCurrency = allCurrencies.find((c) => c.id === p.currencyId);

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        description: p.description,
        category: p.category,
        department: p.category,
        salePrice: Number(p.salePrice),
        offerPrice: p.offerPrice ? Number(p.offerPrice) : null,
        wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : null,
        currencySymbol: productCurrency?.symbol || 'Bs',
        stock: Number(p.stock),
        imageUrl: p.images?.[0] ?? null,
        priceInTarget,
        roundedPrice,
      };
    });

    const productsForPdf = await Promise.all(
      catalogProducts.map(async (p) => {
        if (!p.imageUrl) return { ...p, imageBuffer: null as Buffer | null };

        try {
          const res = await axios.get(p.imageUrl, {
            responseType: 'arraybuffer',
            timeout: 7000,
          });
          return { ...p, imageBuffer: Buffer.from(res.data) };
        } catch {
          this.logger.warn(
            `No se pudo descargar imagen del catálogo: ${p.imageUrl}`,
          );
          return { ...p, imageBuffer: null };
        }
      }),
    );

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        layout: 'portrait',
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── HEADER (only on first page) ──
      const drawHeader = () => {
        doc
          .fillColor('#1A1A2E')
          .font('Helvetica-Bold')
          .fontSize(20)
          .text(companyName, 40, 40);

        if (companyRif) {
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#555555')
            .text(`RIF: ${companyRif}`, 40, 65);
        }

        doc
          .strokeColor('#1B75BC')
          .lineWidth(2)
          .moveTo(40, 82)
          .lineTo(555, 82)
          .stroke();

        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor('#1B75BC')
          .text('CATÁLOGO DE PRODUCTOS', 40, 95, {
            width: 500,
            align: 'center',
          });

        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#666666')
          .text(
            `Moneda: ${targetCurrency?.name || params.currencyCode} (${targetSymbol}) — Precio 1`,
            40,
            115,
            {
              width: 500,
              align: 'center',
            },
          );

        // Column headers
        const headerY = 140;
        doc
          .fillColor('#1B75BC')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('PRODUCTO', 76, headerY, { width: 240 })
          .text('PRECIO', 355, headerY, { width: 80, align: 'right' })
          .text('STOCK', 450, headerY, { width: 55, align: 'right' });

        doc
          .strokeColor('#CCCCCC')
          .lineWidth(0.5)
          .moveTo(40, headerY + 14)
          .lineTo(555, headerY + 14)
          .stroke();
      };

      // ── Render PDF ──
      drawHeader();
      let y = 165;

      const rowHeight = 42; // espacio para nombre de 2 líneas + categoría + padding
      const marginBottom = 780;

      for (let i = 0; i < productsForPdf.length; i++) {
        const p = productsForPdf[i];

        if (y + rowHeight > marginBottom) {
          doc.addPage();
          y = 50;
        }

        if (i % 2 === 0) {
          doc
            .fillColor('#F4F6F8')
            .rect(40, y - 2, 515, rowHeight)
            .fill();
        }

        // Imagen 24x24 o espacio vacío
        const imgX = 44;
        const imgSize = 24;
        if (p.imageBuffer) {
          try {
            doc.image(p.imageBuffer, imgX, y + 5, {
              width: imgSize,
              height: imgSize,
              fit: [imgSize, imgSize],
            });
          } catch {}
        }

        // Nombre en bold — permite 2 líneas (sin ellipsis para que envuelva)
        doc
          .fillColor('#1A1A2E')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(p.name, 76, y + 4, { width: 235 });

        // Categoría debajo (después de las posibles 2 líneas del nombre)
        doc
          .fillColor('#666666')
          .font('Helvetica')
          .fontSize(8)
          .text(p.category?.name || '', 76, y + 26, {
            width: 235,
            ellipsis: true,
          });

        // Precio (alineado con la primera línea del nombre)
        const priceText = `${p.roundedPrice.toFixed(2)} ${targetSymbol}`;
        doc
          .fillColor('#1B75BC')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(priceText, 355, y + 8, { width: 80, align: 'right' });

        // Stock con color
        let stockColor = '#059669';
        if (p.stock === 0) stockColor = '#DC2626';
        else if (p.stock < 5) stockColor = '#D97706';
        doc
          .fillColor(stockColor)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(String(p.stock), 450, y + 8, { width: 55, align: 'right' });

        y += rowHeight;
      }

      doc.end();
    });
  }

  /**
   * Returns catalog data formatted for the frontend preview.
   */
  async getCatalogData(
    currencyCode: string,
    formatCurrency: (value: number) => string,
    categoryIds?: string[],
  ): Promise<CatalogProduct[]> {
    const categoryFilter = categoryIds?.length
      ? { categoryId: { in: categoryIds } }
      : {};

    const [settings, products, allCurrencies] = await Promise.all([
      this.prisma.companySettings.findFirst(),
      this.prisma.product.findMany({
        where: { active: true, ...categoryFilter },
        include: {
          category: { select: { name: true } },
        },
        orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.currency.findMany({ where: { active: true } }),
    ]);

    // Direct conversion to the chosen catalog currency (what the user expects)
    const targetCurrency = allCurrencies.find((c) => c.code === currencyCode);
    const targetRate = targetCurrency
      ? Number(targetCurrency.exchangeRate || 1)
      : 1;

    const isPrimaryCurrency = targetCurrency?.isPrimary ?? false;
    const roundingEnabled =
      isPrimaryCurrency && (settings?.roundingEnabled ?? true);
    const roundingFactor = settings?.roundingFactor ?? 10;

    return products.map((p) => {
      const productCurrency = allCurrencies.find((c) => c.id === p.currencyId);
      const productRate = productCurrency
        ? Number(productCurrency.exchangeRate || 1)
        : 1;

      const priceInVes = Number(p.salePrice) * productRate;
      const priceInTarget = priceInVes / targetRate;
      const roundedPrice = this.applyRounding(
        priceInTarget,
        roundingEnabled,
        roundingFactor,
      );

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        description: p.description,
        category: p.category,
        department: p.category,
        salePrice: Number(p.salePrice),
        offerPrice: p.offerPrice ? Number(p.offerPrice) : null,
        wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : null,
        currencySymbol: productCurrency?.symbol || 'Bs',
        stock: Number(p.stock),
        imageUrl: null,
        priceInTarget,
        roundedPrice,
      };
    });
  }

  /**
   * Sends the catalog PDF via WhatsApp.
   * @param phoneNumber Recipient phone number in international format (e.g. +584121234567)
   * @param pdfBuffer PDF file as buffer (used if pdfBase64 is not provided)
   * @param currencyCode Currency code used in the catalog
   * @param pdfBase64 Optional base64-encoded PDF (data-URL or raw) from the frontend
   */
  async sendCatalogByWhatsApp(
    phoneNumber: string,
    pdfBuffer: Buffer,
    currencyCode: string,
    pdfBase64?: string,
  ): Promise<{ success: boolean; message: string }> {
    const settings = await this.prisma.companySettings.findFirst();

    if (!settings?.phone) {
      return {
        success: false,
        message:
          'No hay número de teléfono de la empresa registrado en Configuración.',
      };
    }

    // Telegram file size limit is 50MB, WhatsApp Media ~ 16MB as document — pdfkit outputs ~small
    const companyName = settings.name || 'MastERP';
    const message = `¡Hola! Te compartimos el catálogo de productos de ${companyName}.\n\nPuedes consultar nuestros precios y disponibilidad en el documento adjunto.`;

    // Build the PDF binary used as form-data attachment
    const base64Str = pdfBase64?.replace(/^data:application\/pdf;base64,/, '');
    const binary = base64Str ? Buffer.from(base64Str, 'base64') : pdfBuffer;

    try {
      const form = new FormData() as any;
      form.append('chatId', `${phoneNumber.replace(/\D/g, '')}@c.us`);
      form.append(
        'document',
        new Blob([binary] as any, { type: 'application/pdf' }),
        `catalogo-${currencyCode}.pdf`,
      );
      form.append('caption', message);

      // WhatsApp Business API endpoint — this is a placeholder
      // Replace with actual WhatsApp Cloud API or Twilio endpoint
      const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || '';
      const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || '';

      if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
        // Development fallback — open WhatsApp Web with pre-filled message + clipboard instruction
        this.logger.warn(
          'WhatsApp API not configured — catalog will open WhatsApp with text message and PDF must be sent manually.',
        );
        return {
          success: false,
          message:
            'WhatsApp Business API no está configurada. Revisa la documentación para configurar WHATSAPP_API_URL y WHATSAPP_API_TOKEN.',
        };
      }

      const response = await axios.post(
        `${WHATSAPP_API_URL}/messages/document`,
        form,
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
            ...form.getHeaders(),
          },
        },
      );

      if (response.data) {
        this.logger.log(`Catalog sent to ${phoneNumber} via WhatsApp`);
        return {
          success: true,
          message: 'Catálogo enviado exitosamente por WhatsApp.',
        };
      }

      return {
        success: false,
        message: 'Error al enviar el catálogo. Intente nuevamente.',
      };
    } catch (error: any) {
      this.logger.error('Error sending catalog via WhatsApp', error.message);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Error al enviar el catálogo.',
      };
    }
  }

  /**
   * Generates a PDF with multiple price tickets (etiquetas).
   * Layout: 2 columns x 5 rows = 10 tickets per A4 page (comfortable readable size).
   */
  async generatePriceTicketsPdf(params: {
    currencyCode: string;
    tickets: Array<{ productId: string; quantity: number }>;
  }): Promise<Buffer> {
    const [settings, allProducts, allCurrencies] = await Promise.all([
      this.prisma.companySettings.findFirst(),
      this.prisma.product.findMany({
        where: { id: { in: params.tickets.map((t) => t.productId) } },
        include: { category: { select: { name: true } } },
      }),
      this.prisma.currency.findMany({ where: { active: true } }),
    ]);

    const companyName = settings?.name || 'MastERP';
    const targetCurrency = allCurrencies.find(
      (c) => c.code === params.currencyCode,
    );
    const targetRate = targetCurrency
      ? Number(targetCurrency.exchangeRate || 1)
      : 1;
    const targetSymbol = targetCurrency?.symbol || 'Bs';

    const isPrimary = targetCurrency?.isPrimary ?? false;
    const roundingEnabled = isPrimary && (settings?.roundingEnabled ?? true);
    const roundingFactor = settings?.roundingFactor ?? 10;

    // Expand tickets with quantities
    const expandedTickets: any[] = [];
    for (const t of params.tickets) {
      const prod = allProducts.find((p) => p.id === t.productId);
      if (!prod) continue;

      // Price conversion (same logic as catalog)
      const productCurrency = allCurrencies.find(
        (c) => c.id === prod.currencyId,
      );
      const productRate = productCurrency
        ? Number(productCurrency.exchangeRate || 1)
        : 1;
      const priceInVes = Number(prod.salePrice) * productRate;
      const priceInTarget = priceInVes / targetRate;
      const roundedPrice = this.applyRounding(
        priceInTarget,
        roundingEnabled,
        roundingFactor,
      );

      for (let i = 0; i < t.quantity; i++) {
        expandedTickets.push({
          name: prod.name,
          sku: prod.sku,
          category: prod.category?.name,
          price: roundedPrice,
          symbol: targetSymbol,
        });
      }
    }

    // Pre-generate barcodes (Code128) before entering the PDFKit Promise (bwipjs.toBuffer is async)
    const barcodeCache = new Map<string, Buffer>();
    const ticketsWithBarcode = await Promise.all(
      expandedTickets.map(async (t) => {
        if (!t.sku) {
          return { ...t, barcodePng: null as Buffer | null };
        }
        if (barcodeCache.has(t.sku)) {
          return { ...t, barcodePng: barcodeCache.get(t.sku)! };
        }
        try {
          const png = await bwipjs.toBuffer({
            bcid: 'code128',
            text: t.sku,
            scale: 2.5,
            height: 9,
            includetext: true,
            textxalign: 'center',
            textsize: 7,
          });
          barcodeCache.set(t.sku, png);
          return { ...t, barcodePng: png };
        } catch (_err) {
          this.logger.warn(
            `No se pudo generar código de barras para SKU: ${t.sku}`,
          );
          return { ...t, barcodePng: null as Buffer | null };
        }
      }),
    );

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 25, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = 595; // A4 width in points
      const pageHeight = 842; // A4 height
      const margin = 25;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const cols = 2;
      const rows = 5;
      const ticketWidth = usableWidth / cols;
      const ticketHeight = usableHeight / rows;

      let index = 0;

      while (index < ticketsWithBarcode.length) {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if (index >= ticketsWithBarcode.length) break;

            const t = ticketsWithBarcode[index];
            const x = margin + col * ticketWidth;
            const y = margin + row * ticketHeight;

            // Ticket border + cut line
            doc
              .strokeColor('#1B75BC')
              .lineWidth(1.5)
              .rect(x + 3, y + 3, ticketWidth - 6, ticketHeight - 6)
              .stroke();

            // Dashed cut lines (horizontal and vertical)
            doc.strokeColor('#CCCCCC').lineWidth(0.5).dash(3, { space: 3 });
            if (col === 0)
              doc
                .moveTo(x + ticketWidth, y)
                .lineTo(x + ticketWidth, y + ticketHeight)
                .stroke();
            if (row < rows - 1)
              doc
                .moveTo(x, y + ticketHeight)
                .lineTo(x + ticketWidth, y + ticketHeight)
                .stroke();
            doc.undash();

            // Content
            const padding = 8;
            const contentX = x + padding;
            const contentWidth = ticketWidth - padding * 2;

            // Name (slightly higher to give room)
            doc
              .fillColor('#1A1A2E')
              .font('Helvetica-Bold')
              .fontSize(9)
              .text(t.name, contentX, y + 6, {
                width: contentWidth,
                height: 26,
                ellipsis: true,
              });

            // Price (big, adjusted up)
            const priceStr = `${t.price.toFixed(2)} ${t.symbol}`;
            doc
              .fillColor('#1B75BC')
              .font('Helvetica-Bold')
              .fontSize(14)
              .text(priceStr, contentX, y + 32, {
                width: contentWidth,
                align: 'center',
              });

            // Code128 barcode (centered in the former blank space)
            if (t.barcodePng) {
              const barcodeWidth = contentWidth * 0.82;
              const barcodeHeight = 34;
              const bx = contentX + (contentWidth - barcodeWidth) / 2;
              const by = y + 55;
              doc.image(t.barcodePng, bx, by, {
                width: barcodeWidth,
                height: barcodeHeight,
              });
            }

            // Category only (SKU now rendered inside the barcode via includetext)
            if (t.category) {
              doc
                .fillColor('#666666')
                .font('Helvetica')
                .fontSize(6)
                .text(t.category, contentX, y + ticketHeight - 16, {
                  width: contentWidth,
                  align: 'center',
                });
            }

            index++;
          }
        }

        if (index < ticketsWithBarcode.length) {
          doc.addPage();
        }
      }

      doc.end();
    });
  }
}
