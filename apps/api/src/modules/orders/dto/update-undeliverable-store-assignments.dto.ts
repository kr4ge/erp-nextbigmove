import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class UpdateUndeliverableStoreAssignmentsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  storeIds?: string[];
}
