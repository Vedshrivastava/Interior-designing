import { MailtrapClient } from 'mailtrap';
import dotenv from 'dotenv';

dotenv.config();

export const mailtrapClient = new MailtrapClient({
  token: process.env.MAILTRAP_TOKEN,
});

export const sender = {
  email: process.env.MAILTRAP_SENDER_EMAIL || 'noreply@shrivastavaselevate.com',
  name: "Shrivastava's Elevate",
};
