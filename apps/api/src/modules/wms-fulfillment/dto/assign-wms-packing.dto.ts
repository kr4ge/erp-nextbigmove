import { IsUUID } from "class-validator";

export class AssignWmsPackingDto {
  @IsUUID()
  stationId!: string;

  @IsUUID()
  packerUserId!: string;
}

