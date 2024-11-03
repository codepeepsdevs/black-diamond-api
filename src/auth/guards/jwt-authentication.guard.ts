import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { SKIP_AUTH_KEY } from './skip-auth.decorator';

@Injectable()
export default class JwtAuthenticationGuard
  extends AuthGuard('jwt')
  implements CanActivate
{
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean {
    const isSkipAuth = this.reflector.getAllAndOverride<boolean>(
      SKIP_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isSkipAuth) {
      return true; // Skip authentication for this route
    }
    return super.canActivate(context) as boolean; // Proceed with normal authentication
  }
}
