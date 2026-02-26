import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BanksService } from './banks.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { LiquidatePosBatchDto } from './dto/liquidate-pos-batch.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('banks')
@UseGuards(AuthGuard('jwt'))
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Post('liquidate-pos')
  liquidatePosBatch(@Body() dto: LiquidatePosBatchDto, @Request() req) {
    return this.banksService.liquidatePosBatch(dto, req.user.id);
  }

  @Post()
  create(@Body() createBankDto: CreateBankAccountDto) {
    return this.banksService.create(createBankDto);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.banksService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.banksService.findOne(id);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.banksService.getHistory(id, limit ? Number(limit) : 50);
  }

  @Post('movements')
  addMovement(@Body() dto: any) {
    return this.banksService.addMovement(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBankDto: UpdateBankAccountDto) {
    return this.banksService.update(id, updateBankDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.banksService.remove(id);
  }
}
