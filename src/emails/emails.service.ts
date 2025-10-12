import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order, User } from '@prisma/client';
import * as ejs from 'ejs';
import * as fs from 'fs';
import { FRONTEND_URL } from 'src/constants';
import { EmailResendService } from './resend.service';

@Injectable()
export class EmailsService {
  private emailResendService: EmailResendService;

  constructor(private configService: ConfigService) {
    this.emailResendService = new EmailResendService(configService);
  }

  async sendVerificationEmail(user: User, token: string): Promise<void> {
    const url = `${this.configService.get<string>(FRONTEND_URL)}/verify-email/${token}`;

    const templateFile = fs.readFileSync(
      './templates/auth/confirmEmail.ejs',
      'utf-8',
    );

    const renderedEmail = ejs.render(templateFile, {
      user,
      confirmationLink: url,
    });

    const result = await this.emailResendService.sendEmail({
      to: user.email,
      subject: 'Verify Your Registration',
      html: renderedEmail,
    });

    if (result.success) {
      console.log('Verification email sent successfully:', result.messageId);
    } else {
      console.error('Error sending verification email:', result.error);
    }
  }

  async sendRegistrationCompletedEmail(user: any): Promise<void> {
    const templateFile = fs.readFileSync(
      './templates/auth/welcome.ejs',
      'utf-8',
    );

    const renderedEmail = ejs.render(templateFile, {
      user,
    });

    const result = await this.emailResendService.sendEmail({
      to: user.email,
      subject: 'Registration Completed',
      html: renderedEmail,
    });

    if (result.success) {
      console.log(
        'Registration completed email sent successfully:',
        result.messageId,
      );
    } else {
      console.error(
        'Error sending registration completed email:',
        result.error,
      );
    }
  }

  async sendWelcomeEmail(user: any): Promise<void> {
    try {
      // Read EJS template file
      const templateFile = fs.readFileSync(
        './templates/auth/welcome.ejs',
        'utf-8',
      );

      const renderedEmail = ejs.render(templateFile, {
        data: user,
      });

      const result = await this.emailResendService.sendEmail({
        to: user.email,
        subject: 'Welcome to BlackDiamond',
        html: renderedEmail,
      });

      if (result.success) {
        console.log('Welcome email sent successfully!', result.messageId);
      } else {
        console.error('Error sending welcome email:', result.error);
      }
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  }

  // async sendConfirmEmail(user: any, confirmationLink: string): Promise<void> {
  //   try {
  //     // Read EJS template file
  //     const templateFile = fs.readFileSync(
  //       './templates/auth/confirmEmail.ejs',
  //       'utf-8',
  //     );

  //     const renderedEmail = ejs.render(templateFile, {
  //       user,
  //       confirmationLink,
  //     });

  //     await transporter.sendMail({
  //       from: 'BlackDiamond <support@eventsbyblackdiamond.com>',
  //       to: user?.email,
  //       subject: 'Confirm Your Email Address for BlackDiamond Registration',
  //       html: renderedEmail,
  //     });

  //     console.log('Welcome email sent successfully!');
  //   } catch (error) {
  //     console.error('Error sending welcome email:', error);
  //   }
  // }

  async sendResetLink(
    user: any,
    email: string,
    resetLink: string,
  ): Promise<void> {
    try {
      // Read EJS template file
      const templateFile = fs.readFileSync(
        './templates/auth/resetPassword.ejs',
        'utf-8',
      );

      const renderedEmail = ejs.render(templateFile, {
        user,
        resetLink,
      });

      const result = await this.emailResendService.sendEmail({
        to: email,
        subject: 'Password Reset Request Confirmation',
        html: renderedEmail,
      });

      if (result.success) {
        console.log(
          'Password Reset Request Confirmation Successfully!',
          result.messageId,
        );
      } else {
        console.error('Error sending reset password:', result.error);
      }
    } catch (error) {
      console.error('Error sending reset password:', error);
    }
  }

  async sendPasswordChanged(user: any, email: string): Promise<void> {
    try {
      // Read EJS template file
      const templateFile = fs.readFileSync(
        './templates/auth/passwordChangedEmail.ejs',
        'utf-8',
      );

      const renderedEmail = ejs.render(templateFile, {
        user,
      });

      const result = await this.emailResendService.sendEmail({
        to: email,
        subject: 'Password Successfully Changed',
        html: renderedEmail,
      });

      if (result.success) {
        console.log(
          'Password changed email sent successfully!',
          result.messageId,
        );
      } else {
        console.error('Error sending password changed email:', result.error);
      }
    } catch (error) {
      console.error('Error sending password changed email:', error);
    }
  }

  async sendCompleteSignup(
    email: string,
    completeSignupLink: string,
  ): Promise<void> {
    try {
      // Read EJS template file
      const templateFile = fs.readFileSync(
        './templates/auth/completeSignup.ejs',
        'utf-8',
      );

      const renderedEmail = ejs.render(templateFile, {
        completeSignupLink,
      });

      const result = await this.emailResendService.sendEmail({
        to: email,
        subject: 'Complete your signup process',
        html: renderedEmail,
      });

      if (result.success) {
        console.log(
          'Complete signup email sent successfully!',
          result.messageId,
        );
      } else {
        console.error('Error sending complete signup email:', result.error);
      }
    } catch (error) {
      console.error('Error sending complete signup email:', error);
    }
  }

  // After successful payment confirmation via webhook
  async sendOrderConfirmed(
    email: string,
    data: {
      ticketLink: string;
      order: any;
      orderDate: string; // normal August 7, 2024
      eventDate: string; // pdt
      ticketGroups: {
        name: string;
        quantity: number;
        price: number;
      }[];
      totalDiscountInDollars: number;
      totalChargesInDollars: number;
    }, // Todo change to return type of the fetch order query
  ): Promise<void> {
    console.log('sending order confirmed email to:', email);
    try {
      // Read EJS template file
      const templateFile = fs.readFileSync(
        './templates/purchase/order-confirmation.ejs',
        'utf-8',
      );

      const renderedEmail = ejs.render(templateFile, data);

      const result = await this.emailResendService.sendEmail({
        to: email,
        subject: 'Your order payment has been confirmed! View tickets',
        html: renderedEmail,
      });

      if (result.success) {
        console.log(
          'Order confirmed email sent!',
          data.order.id,
          result.messageId,
        );
      } else {
        console.error('Error sending order confirmation email:', result.error);
      }
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
    }
  }

  // After successful payment confirmation via webhook
  async sendOrderReceived(
    email: string,
    data: {
      ticketLink: string;
      order: Order;
      orderDate: string; // normal August 7, 2024
      eventDate: string; // pdt
      amountToPay: number;
      ticketGroups: {
        name: string;
        quantity: number;
        price: number;
      }[];
      totalDiscountInDollars: number;
      totalChargesInDollars: number;
    }, // Todo change to return type of the fetch order query
  ): Promise<void> {
    console.log('sending order received email to', email);
    console.log('amount to pay', data.amountToPay);
    try {
      // Read EJS template file
      const templateFile = fs.readFileSync(
        './templates/purchase/order-received.ejs',
        'utf-8',
      );

      const renderedEmail = ejs.render(templateFile, data);

      const result = await this.emailResendService.sendEmail({
        to: email,
        subject: 'Your order has been received!',
        html: renderedEmail,
      });

      if (result.success) {
        console.log(
          'Order received email sent successfully!',
          data.order.id,
          result.messageId,
        );
      } else {
        console.error('Error sending order received email:', result.error);
      }
    } catch (error) {
      console.error('Error sending order received email:', error);
    }
  }

  async sendDynamic(
    email: any,
    data: any,
    fileName: string,
    subject: string,
  ): Promise<any> {
    console.log({ fileName, email });
    try {
      const templateFile = fs.readFileSync(`./templates/${fileName}`, 'utf-8');

      const renderedEmail = ejs.render(templateFile, {
        data,
      });

      const result = await this.emailResendService.sendEmail({
        to: email,
        subject: subject,
        html: renderedEmail,
      });

      if (result.success) {
        console.log('Dynamic email sent successfully:', result.messageId);
        return { message: 'message sent', messageId: result.messageId };
      } else {
        console.error('Error sending dynamic email:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      throw error;
    }
  }
}
