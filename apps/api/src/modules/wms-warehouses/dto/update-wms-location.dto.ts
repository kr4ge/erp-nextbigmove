import { PartialType } from '@nestjs/mapped-types';
import { CreateWmsLocationDto } from './create-wms-location.dto';

export class UpdateWmsLocationDto extends PartialType(CreateWmsLocationDto) {}
