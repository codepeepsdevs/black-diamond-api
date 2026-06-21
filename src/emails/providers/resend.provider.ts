import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  EmailProvider,
  SendEmailOptions,
  SendEmailResult,
} from '../interfaces/email-provider.interface';
import {
  getDefaultFromConfig,
  isValidEmail,
  normalizeRecipients,
  withEmailRetries,
} from '../utils/email.utils';

export class ResendProvider implements EmailProvider {
  private resend: Resend;
  private defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }

    this.resend = new Resend(apiKey);
    this.defaultFrom = getDefaultFromConfig(configService);
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const result = await withEmailRetries(async () => {
        const response = await this.resend.emails.send({
          from: options.from || this.defaultFrom,
          to: normalizeRecipients(options.to),
          subject: options.subject,
          html: options.html,
          replyTo: options.replyTo,
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        return response;
      });

      console.log('Email sent successfully via Resend:', result.data?.id);

      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  isValidEmail(email: string): boolean {
    return isValidEmail(email);
  }

  getDefaultFrom(): string {
    return this.defaultFrom;
  }
}
