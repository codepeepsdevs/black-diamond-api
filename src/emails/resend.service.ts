import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendService } from 'src/utils/resend';

@Injectable()
export class EmailResendService {
  private resendService: ResendService;

  constructor(private configService: ConfigService) {
    this.resendService = new ResendService(configService);
  }

  /**
   * Send email with Resend
   */
  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return await this.resendService.sendEmail(options);
  }

  /**
   * Send email with template rendering
   */
  async sendTemplatedEmail(options: {
    to: string | string[];
    subject: string;
    templatePath: string;
    templateData: any;
    from?: string;
    replyTo?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Import ejs dynamically to avoid circular dependencies
      const ejs = await import('ejs');
      const fs = await import('fs');

      // Read and render template
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
        error: `Template rendering failed: ${error.message}`,
      };
    }
  }

  /**
   * Validate email address
   */
  isValidEmail(email: string): boolean {
    return this.resendService.isValidEmail(email);
  }

  /**
   * Get default from email
   */
  getDefaultFrom(): string {
    return this.resendService.getDefaultFrom();
  }
}
