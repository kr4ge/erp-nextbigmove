import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateSmsTemplateDto } from './dto/create-sms-template.dto';
import { SendSmsMessageDto } from './dto/send-sms-message.dto';
import { SmsService } from './sms.service';

@Controller('sms')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  @Get('overview')
  @Permissions(
    'sms.inbox.read',
    'sms.messages.send',
    'sms.devices.manage',
    'sms.logs.read',
  )
  getOverview() {
    return this.sms.getOverview();
  }

  @Post('messages')
  @Permissions('sms.messages.send')
  sendMessage(@Body() dto: SendSmsMessageDto) {
    return this.sms.sendMessage(dto);
  }

  @Get('conversations')
  @Permissions('sms.inbox.read')
  listConversations(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
    @Query('search') search?: string,
  ) {
    return this.sms.listConversations(limit, cursor, search);
  }

  @Get('conversations/:conversationId/messages')
  @Permissions('sms.inbox.read')
  listConversationMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    return this.sms.listConversationMessages(conversationId, limit);
  }

  @Post('conversations/:conversationId/read')
  @Permissions('sms.inbox.read')
  markConversationRead(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.sms.markConversationRead(conversationId);
  }

  @Get('devices')
  @Permissions('sms.devices.manage', 'sms.inbox.read')
  listDevices() {
    return this.sms.listDevices();
  }

  @Post('devices/enrollment')
  @Permissions('sms.devices.manage')
  createDeviceEnrollment() {
    return this.sms.createDeviceEnrollment();
  }

  @Post('devices/:deviceId/heartbeat-check')
  @Permissions('sms.devices.manage')
  checkDeviceHeartbeat(@Param('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.sms.checkDeviceHeartbeat(deviceId);
  }

  @Get('templates')
  @Permissions('sms.inbox.read', 'sms.templates.manage')
  listTemplates() {
    return this.sms.listTemplates();
  }

  @Post('templates')
  @Permissions('sms.templates.manage')
  createTemplate(@Body() dto: CreateSmsTemplateDto) {
    return this.sms.createTemplate(dto);
  }
}
