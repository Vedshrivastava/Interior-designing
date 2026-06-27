import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
  port: parseInt(process.env.MAILTRAP_PORT || '2525'),
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

export const sender = {
  email: process.env.MAILTRAP_SENDER_EMAIL || 'noreply@shrivastavaseelevate.com',
  name: 'Shrivastavas Elevate',
};
