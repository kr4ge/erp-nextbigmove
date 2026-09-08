import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { EncryptionService } from '../integrations/services/encryption.service';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';

@Module({
  controllers: [AiSettingsController],
  providers: [PermissionsGuard, EncryptionService, AiSettingsService],
  exports: [AiSettingsService],
})
export class AiSettingsModule {}
