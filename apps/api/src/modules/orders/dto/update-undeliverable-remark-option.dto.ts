import { IsString, MaxLength } from 'class-validator';

export class UpdateUndeliverableRemarkOptionDto {
  @IsString()
  @MaxLength(255)
  remark!: string;
}
