/* ─────────────────────────────────────────────────────────
   Shared layout wrapper
───────────────────────────────────────────────────────── */
const wrap = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0ebe3;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ebe3;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(16,37,37,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:#102525;padding:32px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#c9a87c;letter-spacing:1px;">
              Shrivastava's Elevate
            </p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:rgba(201,168,124,0.6);letter-spacing:2px;text-transform:uppercase;">
              Interior Design Studio
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f4ee;padding:20px 40px;border-top:1px solid rgba(201,168,124,0.2);text-align:center;">
            <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;color:#999;">
              This is an automated message — please do not reply.
            </p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#bbb;">
              © ${new Date().getFullYear()} Shrivastava's Elevate · Satna, Madhya Pradesh
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

/* ─────────────────────────────────────────────────────────
   1. Email Verification
───────────────────────────────────────────────────────── */
export const VERIFICATION_EMAIL_TEMPLATE = wrap('Verify Your Email — Shrivastavas Elevate', `
  <h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:#102525;font-weight:700;">
    Verify Your Email Address
  </h2>
  <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;">
    Hello,
  </p>
  <p style="margin:0 0 28px;font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;">
    Thank you for registering with Shrivastava's Elevate Admin Panel. Use the verification code below to complete your registration.
  </p>

  <div style="background:#f8f4ee;border:1px solid rgba(201,168,124,0.3);border-radius:10px;padding:28px;text-align:center;margin-bottom:28px;">
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;color:#999;letter-spacing:2px;text-transform:uppercase;">Your verification code</p>
    <p style="margin:0;font-family:Georgia,serif;font-size:40px;font-weight:700;letter-spacing:10px;color:#c9a87c;">{verificationCode}</p>
  </div>

  <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:#888;line-height:1.6;">
    This code expires in <strong>15 minutes</strong>.
  </p>
  <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#888;line-height:1.6;">
    If you did not request this, please ignore this email.
  </p>
`);

/* ─────────────────────────────────────────────────────────
   2. Welcome Email
───────────────────────────────────────────────────────── */
export const WELCOME_EMAIL_TEMPLATE = wrap('Welcome to Shrivastavas Elevate', `
  <h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:#102525;font-weight:700;">
    Welcome, {name}
  </h2>
  <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;">
    Your account has been successfully verified. You now have access to the Shrivastava's Elevate Admin Panel.
  </p>

  <div style="background:#102525;border-radius:10px;padding:24px 28px;margin-bottom:28px;">
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;color:rgba(201,168,124,0.7);letter-spacing:2px;text-transform:uppercase;">What you can manage</p>
    <p style="margin:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#f0e6d3;">◆ &nbsp;Design gallery — upload and manage interior designs</p>
    <p style="margin:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#f0e6d3;">◆ &nbsp;Projects portfolio — showcase completed projects</p>
    <p style="margin:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#f0e6d3;">◆ &nbsp;Products catalogue — manage architectural materials</p>
    <p style="margin:4px 0;font-family:Arial,sans-serif;font-size:14px;color:#f0e6d3;">◆ &nbsp;Appointments &amp; quotes — track client enquiries</p>
  </div>

  <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#888;line-height:1.6;">
    If you have any questions, contact us at <a href="mailto:shrivastavaselevatepvt.ltd@gmail.com" style="color:#c9a87c;">shrivastavaselevatepvt.ltd@gmail.com</a>
  </p>
`);

/* ─────────────────────────────────────────────────────────
   3. Password Reset Request
───────────────────────────────────────────────────────── */
export const PASSWORD_RESET_REQUEST_TEMPLATE = wrap('Reset Your Password — Shrivastavas Elevate', `
  <h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:#102525;font-weight:700;">
    Reset Your Password
  </h2>
  <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;">
    Hello,
  </p>
  <p style="margin:0 0 28px;font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;">
    We received a request to reset the password for your Shrivastava's Elevate admin account. Click the button below to set a new password.
  </p>

  <div style="text-align:center;margin-bottom:28px;">
    <a href="{resetURL}"
       style="display:inline-block;background:#102525;color:#c9a87c;padding:14px 36px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.5px;text-decoration:none;">
      Reset Password
    </a>
  </div>

  <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13px;color:#888;line-height:1.6;">
    This link expires in <strong>1 hour</strong>.
  </p>
  <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#888;line-height:1.6;">
    If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
  </p>
`);

/* ─────────────────────────────────────────────────────────
   4. Password Reset Success
───────────────────────────────────────────────────────── */
export const PASSWORD_RESET_SUCCESS_TEMPLATE = wrap('Password Reset Successful — Shrivastavas Elevate', `
  <h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:#102525;font-weight:700;">
    Password Reset Successful
  </h2>
  <p style="margin:0 0 28px;font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;">
    Hello, your Shrivastava's Elevate admin password has been successfully reset.
  </p>

  <div style="background:#f8f4ee;border-left:4px solid #c9a87c;border-radius:4px;padding:16px 20px;margin-bottom:28px;">
    <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#444;line-height:1.7;">
      If you did not make this change, contact us immediately at
      <a href="mailto:shrivastavaselevatepvt.ltd@gmail.com" style="color:#c9a87c;">shrivastavaselevatepvt.ltd@gmail.com</a>
    </p>
  </div>

  <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#888;line-height:1.6;">
    For your security, we recommend using a strong, unique password and not sharing it with anyone.
  </p>
`);
