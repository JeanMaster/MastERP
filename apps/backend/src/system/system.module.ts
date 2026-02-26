import { Module } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import * as os from 'os';

@Controller('system')
class SystemController {
  @Get('network')
  getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];

    for (const k in interfaces) {
      for (const k2 in interfaces[k]) {
        const address = interfaces[k][k2];
        if (address.family === 'IPv4' && !address.internal) {
          addresses.push(address.address);
        }
      }
    }

    return {
      localIp: addresses.length > 0 ? addresses[0] : 'localhost',
      allIps: addresses,
      port: process.env.PORT || 3000,
    };
  }
}

@Module({
  controllers: [SystemController],
})
export class SystemModule {}
