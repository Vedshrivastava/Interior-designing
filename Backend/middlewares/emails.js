import { transporter, sender } from "./mailtrap.js";
import {
  VERIFICATION_EMAIL_TEMPLATE,
  WELCOME_EMAIL_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
} from "./emailTemplates.js";

const from = `"${sender.name}" <${sender.email}>`;

export const sendVerificationEmail = async (email, verificationToken) => {
  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Verify your email',
      html: VERIFICATION_EMAIL_TEMPLATE.replace('{verificationCode}', verificationToken),
    });
    console.log('Verification email sent to', email);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error(`Error Sending Verification Email: ${email}`);
  }
};

export const sendWelcomeEmail = async (email, name) => {
  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: "Welcome to Shrivastava's Elevate Admin Panel",
      html: WELCOME_EMAIL_TEMPLATE.replace('{name}', name),
    });
    console.log('Welcome email sent to', email);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new Error(`Error Sending Welcome Email: ${email}`);
  }
};

export const sendPasswordResetEmail = async (email, resetURL) => {
  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Reset your password',
      html: PASSWORD_RESET_REQUEST_TEMPLATE.replace('{resetURL}', resetURL),
    });
    console.log('Password reset email sent to', email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error(`Error Sending Reset Password Email: ${email}`);
  }
};

export const sendResetSuccessEmail = async (email) => {
  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Password reset successful',
      html: PASSWORD_RESET_SUCCESS_TEMPLATE,
    });
    console.log('Password reset success email sent to', email);
  } catch (error) {
    console.error('Error sending reset success email:', error);
    throw new Error(`Error Sending Reset Password Success Email: ${email}`);
  }
};
