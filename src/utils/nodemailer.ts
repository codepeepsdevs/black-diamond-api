import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';

dotenv.config();

export const transporter = nodemailer.createTransport({
  host: 'smtp.titan.email',
  port: 465,
  secure: true,
  auth: {
    user: `${process.env.EMAIL_USERNAME}`,
    pass: `${process.env.EMAIL_PASS}`,
  },
});
