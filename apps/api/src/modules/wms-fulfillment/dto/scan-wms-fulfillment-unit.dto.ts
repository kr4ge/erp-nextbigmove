import { IsString, MaxLength } from "class-validator";

export class ScanWmsFulfillmentUnitDto {
  @IsString()
  @MaxLength(120)
  unitBarcode!: string;
}

