import * as dotenv from 'dotenv';
const nodemailer = require('nodemailer');

dotenv.config();

export const transporter = nodemailer.createTransport({
  host: 'eventsbyblackdiamond.com',
  port: 465,
  secure: true,
  auth: {
    user: `${process.env.EMAIL_USERNAME}`,
    pass: `${process.env.EMAIL_PASS}`,
  },
});

