import { Inject, Injectable } from '@nestjs/common';
import {
  EMAIL_PROVIDER,
  EmailProvider,
  SendEmailOptions,
  SendEmailResult,
} from './interfaces/email-provider.interface';

@Injectable()
export class EmailProviderService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return await this.emailProvider.sendEmail(options);
  }

  async sendTemplatedEmail(options: {
    to: string | string[];
    subject: string;
    templatePath: string;
    templateData: any;
    from?: string;
    replyTo?: string;
  }): Promise<SendEmailResult> {
    try {
      const ejs = await import('ejs');
      const fs = await import('fs');

      const templateFile = fs.readFileSync(options.templatePath, 'utf-8');
      const renderedHtml = ejs.render(templateFile, options.templateData);

      return await this.sendEmail({
        to: options.to,
        subject: options.subject,
        html: renderedHtml,
        from: options.from,
        replyTo: options.replyTo,
      });
    } catch (error) {
      console.error('Error rendering email template:', error);
      return {
        success: false,
        error: `Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  isValidEmail(email: string): boolean {
    return this.emailProvider.isValidEmail(email);
  }

  getDefaultFrom(): string {
    return this.emailProvider.getDefaultFrom();
  }
}
