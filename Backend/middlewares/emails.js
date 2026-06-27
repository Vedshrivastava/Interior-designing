import { mailtrapClient, sender } from "./mailtrap.js";
import {
  VERIFICATION_EMAIL_TEMPLATE,
  WELCOME_EMAIL_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
} from "./emailTemplates.js";

export const sendVerificationEmail = async (email, verificationToken) => {
  try {
    await mailtrapClient.send({
      from: sender,
      to: [{ email }],
      subject: 'Verify your email',
      html: VERIFICATION_EMAIL_TEMPLATE.replace('{verificationCode}', verificationToken),
      category: 'Email Verification',
    });
    console.log('Verification email sent to', email);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error(`Error Sending Verification Email: ${email}`);
  }
};

export const sendWelcomeEmail = async (email, name) => {
  try {
    await mailtrapClient.send({
      from: sender,
      to: [{ email }],
      subject: "Welcome to Shrivastava's Elevate Admin Panel",
      html: WELCOME_EMAIL_TEMPLATE.replace('{name}', name),
      category: 'Welcome',
    });
    console.log('Welcome email sent to', email);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new Error(`Error Sending Welcome Email: ${email}`);
  }
};

export const sendPasswordResetEmail = async (email, resetURL) => {
  try {
    await mailtrapClient.send({
      from: sender,
      to: [{ email }],
      subject: 'Reset your password',
      html: PASSWORD_RESET_REQUEST_TEMPLATE.replace('{resetURL}', resetURL),
      category: 'Password Reset',
    });
    console.log('Password reset email sent to', email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error(`Error Sending Reset Password Email: ${email}`);
  }
};

export const sendResetSuccessEmail = async (email) => {
  try {
    await mailtrapClient.send({
      from: sender,
      to: [{ email }],
      subject: 'Password reset successful',
      html: PASSWORD_RESET_SUCCESS_TEMPLATE,
      category: 'Password Reset',
    });
    console.log('Password reset success email sent to', email);
  } catch (error) {
    console.error('Error sending reset success email:', error);
    throw new Error(`Error Sending Reset Password Success Email: ${email}`);
  }
};
