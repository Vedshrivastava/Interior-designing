import { MailtrapClient } from 'mailtrap';
import dotenv from 'dotenv';

export const mailtrapClient = new MailtrapClient({
  token: process.env.MAILTRAP_TOKEN,
  endpoint: process.env.MAILTRAP_ENDPOINT,
});

export const sender = {
  email: "hello@demomailtrap.com",
  name: "Mailtrap Test",
};