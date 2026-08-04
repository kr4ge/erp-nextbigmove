import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { GatewaySmsEventDto } from './dto/gateway-sms-event.dto';
import { SmsGatewayWebhookGuard } from './guards/sms-gateway-webhook.guard';
import { SmsService } from './sms.service';

@Controller('sms/webhooks')
export class SmsWebhookController {
  constructor(private readonly sms: SmsService) {}

  @Post('gateway')
  @HttpCode(200)
  @UseGuards(SmsGatewayWebhookGuard)
  handleGatewayEvent(@Body() dto: GatewaySmsEventDto) {
    return this.sms.handleGatewayEvent(dto);
  }
}
