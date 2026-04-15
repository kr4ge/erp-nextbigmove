import { IsString, MaxLength } from "class-validator";

export class StartWmsFulfillmentSessionDto {
  @IsString()
  @MaxLength(120)
  trackingNumber!: string;
}

