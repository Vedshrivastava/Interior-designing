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

    console.log("Email:", email);

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
  console.log("Login Admin Request Data:", { email, password });

  try {
    const admin = await userModel.findOne({ email });
    console.log("Admin existence check result:", admin);

    if (!admin || admin.role !== "ADMIN") {
      console.log("Admin not found or not an ADMIN:", email);
      return res.status(400).json({
        success: false,
        message: "Admin does not exist with provided email",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("Incorrect password provided");
      return res.status(400).json({
        success: false,
        message: "Incorrect password",
      });
    }

    const tokenData = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
    };

    const token = await signTokenForAdmin(tokenData);
    console.log("Generated token:", token);

    if (token) {
      console.log("Login successful for:", email);
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
      console.log("Error generating token for:", email);
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

export { registerAdmin, loginAdmin };
