import { ConfigService } from '@nestjs/config';
import { EmailProvider } from '../interfaces/email-provider.interface';
import { ResendProvider } from './resend.provider';
import { ZeptoMailProvider } from './zeptomail.provider';

export function createEmailProvider(
  configService: ConfigService,
): EmailProvider {
  const provider = configService
    .get<string>('EMAIL_PROVIDER', 'resend')
    .toLowerCase();

  switch (provider) {
    case 'zeptomail':
      return new ZeptoMailProvider(configService);
    case 'resend':
    default:
      return new ResendProvider(configService);
  }
}
