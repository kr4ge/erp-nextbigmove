import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class SyncWmsFulfillmentIntakeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

