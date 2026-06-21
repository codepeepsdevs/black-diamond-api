import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProviderService } from './email-provider.service';

@Injectable()
export class EmailTestService {
  constructor(
    private emailProviderService: EmailProviderService,
    private configService: ConfigService,
  ) {}

  /**
   * Test email sending functionality
   */
  async testEmailSending(): Promise<void> {
    console.log('🧪 Testing email functionality...');

    try {
      const result = await this.emailProviderService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Email from BlackDiamond API',
        html: `
          <h1>Test Email</h1>
          <p>This is a test email to verify the configured email provider.</p>
          <p>If you receive this, the email service is working correctly!</p>
        `,
      });

      if (result.success) {
        console.log('✅ Email test successful!', result.messageId);
      } else {
        console.error('❌ Email test failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Email test error:', error);
    }
  }

  /**
   * Test template rendering
   */
  async testTemplateRendering(): Promise<void> {
    console.log('🧪 Testing template rendering...');

    try {
      const result = await this.emailProviderService.sendTemplatedEmail({
        to: 'test@example.com',
        subject: 'Template Test Email',
        templatePath: './templates/auth/welcome.ejs',
        templateData: {
          user: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
        },
      });

      if (result.success) {
        console.log('✅ Template test successful!', result.messageId);
      } else {
        console.error('❌ Template test failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Template test error:', error);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting email service tests...');

    await this.testEmailSending();
    await this.testTemplateRendering();

    console.log('🏁 Email service tests completed!');
  }
}
