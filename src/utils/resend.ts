import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

// Initialize Resend client
export const resend = new Resend(process.env.RESEND_API_KEY);

// Default email configuration
export const DEFAULT_FROM_EMAIL =
  'BlackDiamond <support@eventsbyblackdiamond.com>';

// Email sending wrapper with error handling and retry logic
export class ResendService {
  private resend: Resend;
  private defaultFrom: string;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }

    this.resend = new Resend(apiKey);
    this.defaultFrom =
      configService.get<string>('RESEND_FROM_EMAIL') || DEFAULT_FROM_EMAIL;
  }

  /**
   * Send email with retry logic and proper error handling
   */
  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.resend.emails.send({
          from: options.from || this.defaultFrom,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          replyTo: options.replyTo,
        });

        console.log(
          `Email sent successfully (attempt ${attempt}):`,
          result.data?.id,
        );
        return {
          success: true,
          messageId: result.data?.id,
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`Email send attempt ${attempt} failed:`, error);

        // Don't retry on certain errors (like invalid email addresses)
        if (this.isNonRetryableError(error)) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error occurred',
    };
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    const nonRetryableErrors = [
      'invalid_email',
      'invalid_recipient',
      'rate_limit_exceeded',
      'unauthorized',
    ];

    return nonRetryableErrors.some(
      (errorType) =>
        error?.message?.toLowerCase().includes(errorType) ||
        error?.name?.toLowerCase().includes(errorType),
    );
  }

  /**
   * Validate email address format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get default from email
   */
  getDefaultFrom(): string {
    return this.defaultFrom;
  }
}
