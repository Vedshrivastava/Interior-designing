import userModel from "../models/user.js";
import bcrypt from "bcrypt";
import { signTokenForAdmin } from "../middlewares/index.js";
import validator from "validator";
import { generateVerificationCode } from "../utils/generateVerificationCode.js";
import { sendVerificationEmail } from "../middlewares/emails.js";

const registerAdmin = async (req, res) => {
  const { name, password, email } = req.body;
  try {
    // ── Validations first (before any DB writes) ──
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // ── Create user ──
    const verificationCode = generateVerificationCode();
    const salt             = await bcrypt.genSalt(10);
    const hashedPass       = await bcrypt.hash(password, salt);

    const newUser = new userModel({
      name,
      email,
      password:                    hashedPass,
      verificationToken:           verificationCode,
      verificationTokenExpiresAt:  Date.now() + 24 * 60 * 60 * 1000,
    });

    const user = await newUser.save();

    // ── Send verification email (rollback if it fails) ──
    try {
      await sendVerificationEmail(email, verificationCode);
    } catch (emailError) {
      console.error("Verification email failed, rolling back user creation:", emailError);
      await userModel.findByIdAndDelete(user._id);   // ← rollback
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Account created! Please verify your email.",
      user: {
        ...user._doc,
        password: undefined,
      },
    });

  } catch (error) {
    console.error("registerAdmin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Some internal error occurred.",
    });
  }
};

const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await userModel.findOne({ email });

    if (!admin || (admin.role !== "ADMIN" && admin.role !== "MASTER")) {
      return res.status(400).json({
        success: false,
        message: "Admin does not exist with provided email",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect password",
      });
    }

    const tokenData = {
      id:    admin._id,
      name:  admin.name,
      email: admin.email,
      role:  admin.role,
    };

    const token = await signTokenForAdmin(tokenData);

    if (token) {
      return res.status(200).json({
        success: true,
        token,
        userId: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        message: "Logged in successfully",
        user: {
          ...admin._doc,
          password: undefined, // Exclude password
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Error generating token",
      });
    }
  } catch (error) {
    console.error("Error logging in admin:", error);
    return res.status(500).json({
      success: false,
      message: "Some internal error occurred",
    });
  }
};

const changeEmail = async (req, res) => {
  const { newEmail, password } = req.body;
  try {
    if (!validator.isEmail(newEmail))
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });

    const user = await userModel.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ success: false, message: 'Incorrect password.' });

    const exists = await userModel.findOne({ email: newEmail });
    if (exists && String(exists._id) !== String(req.userId))
      return res.status(409).json({ success: false, message: 'This email is already in use.' });

    user.email      = newEmail;
    user.isVerified = false;
    await user.save();

    return res.json({ success: true, message: 'Email updated. Please verify your new email.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await userModel.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ── MASTER: list all admins ── */
const listAdmins = async (req, res) => {
    try {
        const admins = await userModel.find(
            { role: 'ADMIN' },
            'name email createdAt'
        ).sort({ createdAt: -1 });
        return res.json({ success: true, data: admins });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/* ── MASTER: revoke admin access ── */
const removeAdmin = async (req, res) => {
    const { userId } = req.body;
    try {
        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        if (user.role !== 'ADMIN')
            return res.status(400).json({ success: false, message: 'User is not an admin.' });

        user.role = 'USER';
        await user.save();
        return res.json({ success: true, message: `${user.name}'s admin access has been revoked.` });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export { registerAdmin, loginAdmin, changePassword, changeEmail, listAdmins, removeAdmin };
