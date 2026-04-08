import { PartialType } from '@nestjs/mapped-types';
import { CreateWmsWarehouseDto } from './create-wms-warehouse.dto';

export class UpdateWmsWarehouseDto extends PartialType(CreateWmsWarehouseDto) {}
