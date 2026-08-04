import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CommonServicesModule } from '../../common/services/services.module';
import { SMS_OUTBOUND_QUEUE } from './sms.constants';
import { SmsGatewayWebhookGuard } from './guards/sms-gateway-webhook.guard';
import { SmsController } from './sms.controller';
import { SmsGatewayClient } from './sms-gateway.client';
import { SmsOutboxProcessor } from './sms-outbox.processor';
import { SmsOutboxRecoveryService } from './sms-outbox-recovery.service';
import { SmsOutboxService } from './sms-outbox.service';
import { SmsPhoneService } from './sms-phone.service';
import { SmsService } from './sms.service';
import { SmsWebhookController } from './sms-webhook.controller';

@Module({
  imports: [
    PrismaModule,
    CommonServicesModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: SMS_OUTBOUND_QUEUE,
    }),
  ],
  controllers: [SmsController, SmsWebhookController],
  providers: [
    SmsService,
    SmsPhoneService,
    SmsGatewayClient,
    SmsOutboxService,
    SmsOutboxProcessor,
    SmsOutboxRecoveryService,
    SmsGatewayWebhookGuard,
  ],
  exports: [SmsService],
})
export class SmsModule {}
