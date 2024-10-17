import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor() {
    super({
      accessType: 'offline',
    });
  }
  // Override the getAuthenticateOptions method to add custom options
  getAuthenticateOptions(context: ExecutionContext) {
    const options = super.getAuthenticateOptions(context);
    return {
      ...options,
      prompt: 'select_account', // Add the custom prompt option here
    };
  }
}
