import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum GatewaySmsEventType {
  DEVICE_ENROLLED = 'DEVICE_ENROLLED',
  DEVICE_HEARTBEAT = 'DEVICE_HEARTBEAT',
  DISPATCH_ACCEPTED = 'DISPATCH_ACCEPTED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  RECEIVED = 'RECEIVED',
}

export class GatewaySmsSimDto {
  @IsString()
  @MaxLength(256)
  externalSimId!: string;

  @IsString()
  @MaxLength(64)
  subscriptionId!: string;

  @IsInt()
  @Min(0)
  slotIndex!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  carrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  alias?: string;
}

export class GatewaySmsDeviceDto {
  @IsString()
  @MaxLength(128)
  externalDeviceId!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;

  @IsISO8601()
  lastSeenAt!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GatewaySmsSimDto)
  sims!: GatewaySmsSimDto[];
}

export class GatewaySmsEventDto {
  @IsString()
  @MaxLength(128)
  eventId!: string;

  @IsUUID()
  tenantId!: string;

  @IsEnum(GatewaySmsEventType)
  type!: GatewaySmsEventType;

  @IsOptional()
  @IsUUID()
  messageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  gatewayMessageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalSimId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  body?: string;

  @IsISO8601()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  errorCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GatewaySmsDeviceDto)
  device?: GatewaySmsDeviceDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
