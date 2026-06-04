import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

@ApiTags('catalog')
@Controller('catalog')
@UseGuards(AuthGuard('jwt'))
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  private normalizeCategoryIds(
    input?: string | string[],
  ): string[] | undefined {
    if (!input) return undefined;
    const arr = Array.isArray(input) ? input : input.split(',');
    return arr.map((id) => id.trim()).filter(Boolean);
  }

  /**
   * Returns catalog data as JSON for the frontend preview/table.
   * @param currencyCode Target currency code (default: VES)
   */
  @Get('data')
  @ApiOperation({ summary: 'Get catalog product data in selected currency' })
  @ApiQuery({
    name: 'currencyCode',
    required: false,
    type: String,
    description: 'Target currency code (default: VES)',
  })
  @ApiResponse({
    status: 200,
    description: 'Catalog data returned successfully',
  })
  getCatalogData(
    @Query('currencyCode') currencyCode: string = 'VES',
    @Query('categoryIds') categoryIds?: string | string[],
  ) {
    const ids = this.normalizeCategoryIds(categoryIds);
    return this.catalogService.getCatalogData(
      currencyCode,
      this.catalogService.formatVenezuelanPrice,
      ids,
    );
  }

  /**
   * Generates and returns the catalog as a PDF file download.
   * @param currencyCode Target currency code
   */
  @Get('download')
  @ApiOperation({ summary: 'Download catalog as PDF in selected currency' })
  @ApiQuery({
    name: 'currencyCode',
    required: false,
    type: String,
    description: 'Target currency code (default: VES)',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF file returned',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({ status: 500, description: 'Error generating PDF' })
  async downloadCatalog(
    @Query('currencyCode') currencyCode: string = 'VES',
    @Query('categoryIds') categoryIds: string | string[] = [],
    @Res() res: Response,
  ) {
    const ids = this.normalizeCategoryIds(categoryIds);
    const pdfBuffer = await this.catalogService.generateCatalogPdf({
      currencyCode,
      formatCurrency: this.catalogService.formatVenezuelanPrice,
      categoryIds: ids,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="catalogo-${currencyCode}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  /**
   * Sends the catalog PDF via WhatsApp to a specified phone number.
   * @param phone Recipient phone in international format (e.g. +584121234567)
   * @param currencyCode Target currency code
   */
  @Post('send-whatsapp')
  @ApiOperation({ summary: 'Send catalog PDF via WhatsApp' })
  @ApiResponse({ status: 200, description: 'WhatsApp message sent' })
  @ApiResponse({
    status: 400,
    description: 'Missing configuration or phone number',
  })
  async sendWhatsApp(
    @Body()
    body: {
      phone: string;
      currencyCode?: string;
      pdfBase64?: string;
      categoryIds?: string[];
    },
  ) {
    const { phone, currencyCode = 'VES', pdfBase64, categoryIds } = body;
    if (!phone) {
      return { success: false, message: 'Número de teléfono es requerido.' };
    }

    const pdfBuffer = await this.catalogService.generateCatalogPdf({
      currencyCode,
      formatCurrency: this.catalogService.formatVenezuelanPrice,
      categoryIds,
    });

    return this.catalogService.sendCatalogByWhatsApp(
      phone,
      pdfBuffer,
      currencyCode,
      pdfBase64,
    );
  }

  /**
   * Generates price tickets PDF.
   * Body: { currencyCode, tickets: [{productId, quantity}] }
   */
  @Post('price-tickets')
  @ApiOperation({ summary: 'Generate price tickets PDF' })
  async generatePriceTickets(
    @Body()
    body: {
      currencyCode?: string;
      tickets: Array<{ productId: string; quantity: number }>;
      includeBarcode?: boolean;
    },
    @Res() res: Response,
  ) {
    const { currencyCode = 'VES', tickets = [], includeBarcode = true } = body;

    if (!tickets.length) {
      return res
        .status(400)
        .send({ message: 'Debe enviar al menos un ticket' });
    }

    const pdfBuffer = await this.catalogService.generatePriceTicketsPdf({
      currencyCode,
      tickets,
      includeBarcode,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tickets-${currencyCode}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }
}
