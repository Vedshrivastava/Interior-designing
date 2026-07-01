import userModel from "../models/user.js";
import bcrypt from 'bcryptjs';
import validator from "validator";
import crypto from 'crypto';
import { sendVerificationEmail, sendWelcomeEmail, sendResetSuccessEmail, sendPasswordResetEmail } from "../middlewares/emails.js";
import { generateVerificationCode } from "../utils/generateVerificationCode.js";

const verifyEmail = async (req, res) => {

  const { code } = req.body;

  try {
    const user = await userModel.findOne({
      verificationToken: code,
      verificationTokenExpiresAt: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;
    await user.save();

    await sendWelcomeEmail(user.email, user.name);

    return res.json({
      success: true,
      user: {
        ...user._doc,
        password: undefined
      },
      message: "Email verified successfully",
    });

  } catch (error) {
    console.log(error);
    return res.json({
      success: false,
      message: "Error in verifying email",
    });
  }
}

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    console.log("Reset Token : ", resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // ✅ always stored as Date

    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpiresAt = resetTokenExpiresAt;

    await user.save();

    await sendPasswordResetEmail(user.email, `http://localhost:5174/reset-password/${resetToken}`);
    
    return res.status(200).json({ success: true, message: "Password reset email sent" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Some Internal Error Occurred",
    });
  }
};


const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await userModel.findOne({
      resetPasswordToken: token,
      resetPasswordTokenExpiresAt: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiresAt = undefined;
    await user.save();

    await sendResetSuccessEmail(user.email);

    return res.status(200).json({ success: true, message: "Password has been reset successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Some Internal Error Occurred",
    });
  }
};

const checkAuth = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId).select("-password"); //- so that the password is unselected so we do not need to set the pass as undefined.
    
    if(!user) return res.status(400).json({ success: false, message: "User not found" });

    res.status(200).json({success: true, user });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// Add this controller to your user controller file (e.g. userController.js)
// and register the route as:
//   GET /api/user/verify-reset-token/:token

const verifyResetToken = async (req, res) => {
  const { token } = req.params;
  try {
    const user = await userModel.findOne({
      resetPasswordToken: token,
      resetPasswordTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Link expired or invalid" });
    }

    return res.status(200).json({ success: true, message: "Token is valid" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const resendVerification = async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  try {
    if (!email || !validator.isEmail(email))
      return res.status(400).json({ success: false, message: 'Valid email is required.' });

    const user = await userModel.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: 'No account found with this email.' });
    if (user.isVerified)
      return res.status(400).json({ success: false, message: 'This email is already verified.' });

    const verificationCode = generateVerificationCode();
    user.verificationToken = verificationCode;
    user.verificationTokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(email, verificationCode);

    return res.json({ success: true, message: 'Verification code resent successfully.' });
  } catch (error) {
    console.error('resendVerification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resend verification email.' });
  }
};

export { verifyEmail, forgotPassword, resetPassword, checkAuth, verifyResetToken, resendVerification };
