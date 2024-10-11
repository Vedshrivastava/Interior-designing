import userModel from "../models/user.js";
import bcrypt from "bcrypt";
import { signTokenForAdmin } from "../middlewares/index.js";

const registerAdmin = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    const exist = await userModel.findOne({ email });

    if (exist) {
      return res.status(400).json({
        success: false,
        message: "Admin already exists with provided email",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "The password must be at least 8 characters long.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(password, salt);

    const newAdmin = new userModel({
      name,
      email,
      password: hashedPass,
      role: "ADMIN",
    });

    const admin = await newAdmin.save();

    return res.status(201).json({
      success: true,
      userId: admin._id,
      message: "Admin created successfully",
      user: {
        ...admin._doc,
        password: undefined, // Exclude password
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Some internal error occurred",
    });
  }
};

const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await userModel.findOne({ email });

    if (!admin || admin.role !== "ADMIN") {
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
      id: admin._id,
      name: admin.name,
      email: admin.email,
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
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Some internal error occurred",
    });
  }
};

export { registerAdmin, loginAdmin };
