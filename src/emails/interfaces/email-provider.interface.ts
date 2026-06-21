export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  isValidEmail(email: string): boolean;
  getDefaultFrom(): string;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
