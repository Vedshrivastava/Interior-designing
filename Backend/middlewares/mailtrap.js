import { MailtrapClient } from 'mailtrap';
import dotenv from 'dotenv';

dotenv.config(); 

// 🚨 Add these lines to check your environment variables:
console.log("--- MAILTRAP DEBUG ---");
console.log("Token loaded:", !!process.env.MAILTRAP_TOKEN);
console.log("Inbox ID loaded:", process.env.MAILTRAP_INBOX_ID);
console.log("----------------------");

export const mailtrapClient = new MailtrapClient({
  token: process.env.MAILTRAP_TOKEN,
  sandbox: true,
  testInboxId: Number(process.env.MAILTRAP_INBOX_ID), 
});

export const sender = {
  email: "hello@demomailtrap.com",
  name: "Mailtrap Test",
};