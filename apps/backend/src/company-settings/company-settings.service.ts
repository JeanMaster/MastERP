import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@Injectable()
export class CompanySettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieves the company settings (singleton pattern).
   * If no settings record exists, creates a default one.
   * @returns The company settings record.
   */
  async getSettings() {
    let settings = await this.prisma.companySettings.findFirst({
      include: { preferredSecondaryCurrency: true },
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await this.prisma.companySettings.create({
        data: {
          name: 'MastERP',
          rif: 'J-00000000-0',
          logoUrl: null,
        },
        include: { preferredSecondaryCurrency: true },
      });
    }

    return settings;
  }

  /**
   * Updates the company settings.
   * @param dto The updated settings data.
   * @returns The updated settings record.
   */
  async updateSettings(dto: UpdateCompanySettingsDto) {
    const existing = await this.getSettings();

    if (!existing) {
      throw new Error('Company settings not configured');
    }

    return this.prisma.companySettings.update({
      where: { id: existing.id },
      data: dto,
      include: { preferredSecondaryCurrency: true },
    });
  }
}
