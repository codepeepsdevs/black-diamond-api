import { ConfigService } from '@nestjs/config';
import { SendMailClient } from 'zeptomail';
import {
  EmailProvider,
  SendEmailOptions,
  SendEmailResult,
} from '../interfaces/email-provider.interface';
import {
  getDefaultFromConfig,
  isValidEmail,
  normalizeRecipients,
  parseFromAddress,
  withEmailRetries,
} from '../utils/email.utils';

export class ZeptoMailProvider implements EmailProvider {
  private client: SendMailClient;
  private defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    const token = configService.get<string>('ZEPTOMAIL_TOKEN');

    if (!token) {
      throw new Error('ZEPTOMAIL_TOKEN environment variable is required');
    }

    this.client = new SendMailClient({
      url: 'api.zeptomail.com/',
      token,
    });
    this.defaultFrom = getDefaultFromConfig(configService);
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const from = parseFromAddress(options.from || this.defaultFrom);
    const recipients = normalizeRecipients(options.to);

    try {
      const result = await withEmailRetries(async () => {
        return await this.client.sendMail({
          from: {
            address: from.email,
            name: from.name,
          },
          to: recipients.map((email) => ({
            email_address: {
              address: email,
              name: email,
            },
          })),
          subject: options.subject,
          htmlbody: options.html,
          ...(options.replyTo
            ? {
                reply_to: [
                  {
                    address: options.replyTo,
                    name: options.replyTo,
                  },
                ],
              }
            : {}),
        });
      });

      const messageId = this.extractMessageId(result);
      console.log('Email sent successfully via ZeptoMail:', messageId);

      return {
        success: true,
        messageId,
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

  private extractMessageId(result: unknown): string | undefined {
    if (!result || typeof result !== 'object') {
      return undefined;
    }

    const payload = result as {
      request_id?: string;
      data?: Array<{ message_id?: string }>;
    };

    return payload.request_id || payload.data?.[0]?.message_id;
  }
}
