import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

function parseUuidList(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];

  return Array.from(
    new Set(
      values
        .flatMap((entry) => String(entry).split(','))
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export class GetWmsMonthEndStockReportDto {
  @Transform(({ value }) => parseUuidList(value))
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  tenantIds: string[] = [];

  @Transform(({ value }) => parseUuidList(value))
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  storeIds: string[] = [];
}
