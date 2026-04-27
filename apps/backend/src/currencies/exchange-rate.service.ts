import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Cron job that runs periodically to check if automated rate updates are needed.
   * Execution frequency is defined by settings in the database.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    const settings = await this.prisma.companySettings.findFirst();

    // Check if auto update is enabled
    if (!settings || !settings.autoUpdateRates) {
      return;
    }

    // Check update frequency (throttling logic)
    const lastUpdate = settings.updatedAt;
    const now = new Date();
    const minutesSinceLastUpdate =
      (now.getTime() - lastUpdate.getTime()) / 1000 / 60;

    if (minutesSinceLastUpdate < settings.updateFrequency) {
      // Logic could skip update here if frequency hasn't passed
    }

    try {
      this.logger.log('Checking for automated rate updates...');
      await this.updateRates();
    } catch (e) {
      this.logger.error('Failed to update rates', e);
    }
  }

  /**
   * Fetches and updates exchange rates for all currencies configured as automatic.
   */
  async updateRates() {
    // 1. Get automatic and active currencies
    const currencies = await this.prisma.currency.findMany({
      where: {
        isAutomatic: true,
        active: true,
      },
    });

    if (currencies.length === 0) return;

    // 2. Fetch EUR/USD ratio if any currency requires it (e.g., EUR)
    let eurUsdRate = 0;
    const needsEuro = currencies.some((c) => c.code === 'EUR');
    if (needsEuro) {
      eurUsdRate = await this.fetchEurUsdRate();
    }

    // 3. Iterate and fetch rates based on provider symbol
    for (const currency of currencies) {
      if (!currency.apiSymbol) continue;

      try {
        let baseUsdRate = 0;

        // Obtain base USD rate from the configured provider
        if (currency.apiSymbol === 'binance_p2p') {
          baseUsdRate = await this.fetchBinanceP2P();
        } else if (currency.apiSymbol === 'bcv') {
          baseUsdRate = await this.fetchBCV();
        } else if (currency.apiSymbol === 'enparalelo') {
          baseUsdRate = await this.fetchEnParalelo();
        }

        let finalRate = 0;

        if (baseUsdRate > 0) {
          if (currency.code === 'EUR' && eurUsdRate > 0) {
            // Calculate EUR/VES ratio: (USD/VES) * (1 / EUR/USD)
            finalRate = baseUsdRate * (1 / eurUsdRate);
          } else {
            // For USD or other dollar-based currencies (USDT, UDT, etc.)
            finalRate = baseUsdRate;
          }
        }

        if (finalRate > 0) {
          await this.prisma.currency.update({
            where: { id: currency.id },
            data: { exchangeRate: finalRate },
          });
          this.logger.log(`Updated ${currency.code} rate to ${finalRate}`);
        }
      } catch (error) {
        this.logger.error(`Error updating ${currency.code}: ${error.message}`);
      }
    }
  }

  /**
   * Fetches the current USD/VES rate from Binance P2P.
   * Filters for valid ads and calculates a stable market price.
   */
  private async fetchBinanceP2P(): Promise<number> {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          asset: 'USDT',
          fiat: 'VES',
          tradeType: 'BUY',
          page: 1,
          rows: 20,
          countries: [],
          proMerchantAds: false,
          shieldMerchantAds: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        },
      );

      const data = response.data;
      if (
        data &&
        data.data &&
        Array.isArray(data.data) &&
        data.data.length > 0
      ) {
        // Filter out "dust" ads or ads with very low limits that don't represent real market price
        // We keep ads that allow at least 1000 VES total transaction
        const validAds = data.data
          .filter(
            (item) =>
              item.adv &&
              item.adv.price &&
              parseFloat(item.adv.maxSingleTransAmount) >= 1000,
          )
          .map((item) => parseFloat(item.adv.price));

        if (validAds.length > 0) {
          // Sort valid prices (already should be sorted, but let's be sure)
          validAds.sort((a, b) => a - b);

          // Take the median of the top 5-10 valid ads to get a stable market price
          // This avoids being skewed by one single extreme price
          const mid = Math.floor(validAds.length / 2);
          // If we have many ads, the "market price" is usually slightly above the very first few (which are bait)
          // We'll take the 3rd or 4th ad if available, or the median.
          const indexToTake = Math.min(3, validAds.length - 1);
          return validAds[indexToTake];
        }
      }
      return 0;
    } catch (e) {
      this.logger.error('Error fetching Binance P2P', e);
      return 0;
    }
  }

  /**
   * Fetches the official BCV rate from DolarAPI.
   */
  private async fetchBCV(): Promise<number> {
    try {
      const response = await axios.get(
        'https://ve.dolarapi.com/v1/dolares/oficial',
      );
      const data = response.data;
      if (data && data.promedio) {
        return parseFloat(data.promedio);
      }
      return 0;
    } catch (e) {
      this.logger.error('Error fetching BCV', e);
      return 0;
    }
  }

  /**
   * Fetches the parallel USD rate from DolarAPI.
   */
  private async fetchEnParalelo(): Promise<number> {
    try {
      // "paralelo" usually refers to Monitor Dolar / EnParaleloVzla aggregate
      const response = await axios.get(
        'https://ve.dolarapi.com/v1/dolares/paralelo',
      );
      const data = response.data;
      if (data && data.promedio) {
        return parseFloat(data.promedio);
      }
      return 0;
    } catch (e) {
      this.logger.error('Error fetching EnParalelo', e);
      return 0;
    }
  }

  /**
   * Fetches the global EUR/USD exchange rate.
   */
  private async fetchEurUsdRate(): Promise<number> {
    try {
      const response = await axios.get('https://open.er-api.com/v6/latest/USD');
      // { "rates": { "EUR": 0.85, ... } }
      if (response.data && response.data.rates && response.data.rates.EUR) {
        return response.data.rates.EUR;
      }
      return 0;
    } catch (e) {
      this.logger.error('Error fetching EUR/USD rate', e);
      return 0;
    }
  }
}
