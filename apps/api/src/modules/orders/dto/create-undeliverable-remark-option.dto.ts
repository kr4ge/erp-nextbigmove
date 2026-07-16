import { IsString, MaxLength } from 'class-validator';

export class CreateUndeliverableRemarkOptionDto {
  @IsString()
  @MaxLength(255)
  remark!: string;
}
