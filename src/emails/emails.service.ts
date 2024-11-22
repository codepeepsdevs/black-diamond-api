import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order, User } from '@prisma/client';
import * as ejs from 'ejs';
import * as fs from 'fs';
import { FRONTEND_URL } from 'src/constants';
import { transporter } from 'src/utils/nodemailer';

@Injectable()
export class EmailsService {
  constructor(private configService: ConfigService) {}

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

    const mailOptions = {
      from: 'BlackDiamond <support@eventsbyblackdiamond.com>',
      to: user.email,
      subject: 'Verify Your Registration',
      html: renderedEmail,
    };

    transporter.sendMail(mailOptions, (error: any, info: any) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });
  }

  async sendRegistrationCompletedEmail(user: any): Promise<void> {
    const templateFile = fs.readFileSync(
      './templates/auth/welcome.ejs',
      'utf-8',
    );

    const renderedEmail = ejs.render(templateFile, {
      user,
    });

    const mailOptions = {
      from: 'BlackDiamond <support@eventsbyblackdiamond.com>',
      to: user.email,
      subject: 'Registration Completed',
      html: renderedEmail,
    };

    transporter.sendMail(mailOptions, (error: any, info: any) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });
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

      await transporter.sendMail({
        from: 'BlackDiamond <support@eventsbyblackdiamond.com>',
        to: user.email,
        subject: 'Welcome toBlackDiamond',
        html: renderedEmail,
      });

      console.log('Welcome email sent successfully!');
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

      await transporter.sendMail({
        from: 'BlackDiamond <support@eventsbyblackdiamond.com>',
        to: email,
        subject: 'Password Reset Request Confirmation',
        html: renderedEmail,
      });

      console.log('Password Reset Request Confirmation Successfully!');
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

      await transporter.sendMail({
        from: 'BlackDiamond <support@eventsbyblackdiamond.com>',
        to: email,
        subject: 'Password Successfully Changed',
        html: renderedEmail,
      });

      console.log('Password changed email sent successfully!');
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

      await transporter.sendMail({
        from: 'BlackDiamond <support@eventsbyblackdiamond.com>',
        to: email,
        subject: 'Complete your signup process',
        html: renderedEmail,
      });

      console.log('Complete signup email sent successfully!');
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

      await transporter.sendMail({
        from: 'BlackDiamond <support@eventsbyblackdiamond.com>',
        to: email,
        subject: 'Your order payment has been confirmed! View tickets',
        html: renderedEmail,
      });

      console.log('Order confirmed email sent!', data.order.id);
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

      await transporter.sendMail({
        from: 'BlackDiamond <support@eventsbyblackdiamond.com>',
        to: email,
        subject: 'Your order has been received!',
        html: renderedEmail,
      });

      console.log('Order received email sent successfully!', data.order.id);
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

      await transporter.sendMail(
        {
          from: 'BlackDiamond <support@eventsbyblackdiamond.com>',
          to: email,
          subject: subject,
          html: renderedEmail,
        },
        (error: any, info: any) => {
          if (error) {
            console.error('Error sending email:', error);
          } else {
            console.log('Email sent:', info.response);
          }
        },
      );

      return { message: 'message sent' };
    } catch (error) {
      throw error;
    }
  }
}
