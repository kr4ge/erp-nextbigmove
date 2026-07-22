import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClaimPosShopOwnershipDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
