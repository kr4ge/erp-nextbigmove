import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;

    if (user?.tenantId) {
      // Set tenant context in CLS
      this.cls.set('tenantId', user.tenantId);
      this.cls.set('userId', user.userId);
      this.cls.set('userRole', user.role);
      this.cls.set('userPermissions', user.permissions || []);
    }

    next();
  }
}
