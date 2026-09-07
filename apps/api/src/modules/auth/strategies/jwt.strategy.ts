import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: any) {
    // Validate user still exists and is active
    const user = await this.authService.validateUser(payload.userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    // The session's tenant comes from the token (validated against membership),
    // so one identity can hold different tenants open in different sessions.
    const active = await this.authService.resolveActiveTenant(
      user.id, user.role, user.tenantId, payload.tenantId, user.defaultTeamId,
    );

    // Return user data to be attached to request.user
    return {
      userId: user.id,
      email: user.email,
      tenantId: active.tenantId,
      role: user.role,
      permissions: user.permissions,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      defaultTeamId: active.defaultTeamId,
      employeeId: user.employeeId,
      sessionId:
        typeof payload.sessionId === 'string' && payload.sessionId.trim().length > 0
          ? payload.sessionId
          : null,
      // Carried through so writes can be attributed to the real actor and the
      // session can be handed back. Absent on a normal sign-in.
      impersonatedBy:
        typeof payload.impersonatedBy === 'string' ? payload.impersonatedBy : null,
      originalSessionId:
        typeof payload.originalSessionId === 'string' ? payload.originalSessionId : null,
    };
  }
}
