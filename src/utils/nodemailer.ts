import * as dotenv from 'dotenv';
const nodemailer = require('nodemailer');

dotenv.config();

export const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: `${process.env.EMAIL_USERNAME}`,
    pass: `${process.env.EMAIL_PASS}`,
  },
});
