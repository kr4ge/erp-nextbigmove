import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isCreativeAiEnabled } from '../utils/creative-ai-enabled';

@Injectable()
export class CreativeAiEnabledGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isCreativeAiEnabled()) {
      throw new ServiceUnavailableException(
        'Creative AI is disabled in this environment.',
      );
    }
    return true;
  }
}
