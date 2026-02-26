import { PartialType } from '@nestjs/swagger';
import { CreateBankAccountDto } from './create-bank-account.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
