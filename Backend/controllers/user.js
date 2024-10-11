import userModel from "../models/user.js";
import bcrypt from "bcrypt";
import validator from "validator";
import crypto from 'crypto';
import { sendVerificationEmail, sendWelcomeEmail, sendResetSuccessEmail, sendPasswordResetEmail } from "../middlewares/emails.js";
import {
  signTokenForConsumer,
} from "../middlewares/index.js";
import { generateVerificationCode } from "../utils/generateVerificationCode.js";

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await userModel.findOne({ email });

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "The user does not exist",
      });
    }

    // Compare provided password with stored password
    const isMatch = await bcrypt.compare(password, user.password);

    // Check if password matches
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Wrong password",
      });
    }

    // Prepare token data
    const tokenData = {
      id: user._id,
      name: user.name,
      email: user.email,
    };

    // Generate token for the user
    const token = await signTokenForConsumer(tokenData);

    // Check if the token was generated
    if (token) {
      return res.status(200).json({
        success: true,
        token,
        userId: user._id,
        name: user.name,
        email: user.email,
        cartItems: user.cartItems,
        message: "Logged in successfully",
        user: {
          ...user._doc,
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
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Some internal error occurred",
    });
  }
};


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


const registerUser = async (req, res) => {
  const { name, password, email } = req.body;
  try {
    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: "User Already Exists" });
    }
    console.log("Email:", email);

    if (!validator.isEmail(email)) {
      return res.json({
        success: false,
        message: "Please Enter a valid email",
      });
    }

    if (password.length < 8) {
      return res.json({
        success: false,
        message: "The password must be at least 8 digits long.",
      });
    }

    const verificationCode = generateVerificationCode();

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(password, salt);

    const newUser = new userModel({
      name: name,
      email: email,
      password: hashedPass,
      verificationToken: verificationCode,
      verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000
    });

    const user = await newUser.save();

    await sendVerificationEmail(email, verificationCode);


    return res.json({
      success: true,
      userId: user._id,
      message: "Account Created",
      user:{
        ...user._doc,
        password: undefined
      },
    });
  } catch (error) {
    console.log(error);
    return res.json({
      success: false,
      message: "Some Internal Error Occurred",
    });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    console.log("Reset Token : ", resetToken);
    const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000;

    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpiresAt = resetTokenExpiresAt;

    await user.save();

    await sendPasswordResetEmail(user.email, `http://localhost:5173/reset-password/${resetToken}`);
    
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

export { loginUser, registerUser, verifyEmail, forgotPassword, resetPassword, checkAuth };
