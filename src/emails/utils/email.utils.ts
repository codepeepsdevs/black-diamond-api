import { ConfigService } from '@nestjs/config';

export const DEFAULT_FROM_EMAIL =
  'BlackDiamond <support@eventsbyblackdiamond.com>';

export interface ParsedFromAddress {
  name: string;
  email: string;
}

export function parseFromAddress(from: string): ParsedFromAddress {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }

  return { name: '', email: from.trim() };
}

export function formatFromAddress(name: string, email: string): string {
  return name ? `${name} <${email}>` : email;
}

export function getDefaultFromConfig(configService: ConfigService): string {
  const configuredFrom =
    configService.get<string>('EMAIL_FROM') ||
    configService.get<string>('RESEND_FROM_EMAIL') ||
    configService.get<string>('ZEPTOMAIL_FROM_EMAIL');

  if (configuredFrom?.includes('<')) {
    return configuredFrom;
  }

  const email =
    configuredFrom || parseFromAddress(DEFAULT_FROM_EMAIL).email;
  const name =
    configService.get<string>('EMAIL_FROM_NAME') ||
    parseFromAddress(DEFAULT_FROM_EMAIL).name;

  return formatFromAddress(name, email);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function normalizeRecipients(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}

export function isNonRetryableEmailError(error: unknown): boolean {
  const nonRetryableErrors = [
    'invalid_email',
    'invalid_recipient',
    'rate_limit_exceeded',
    'unauthorized',
    'invalid',
    'validation',
    'sm_111',
    'sm_151',
  ];

  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error);

  return nonRetryableErrors.some((errorType) =>
    message.toLowerCase().includes(errorType),
  );
}

export async function withEmailRetries<T>(
  operation: () => Promise<T>,
  options?: { maxRetries?: number },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`Email send attempt ${attempt} failed:`, error);

      if (isNonRetryableEmailError(error)) {
        break;
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unknown error occurred while sending email');
}
