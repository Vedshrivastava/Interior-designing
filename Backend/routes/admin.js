import express from "express";
import { registerAdmin,loginAdmin } from "../controllers/admin.js";
import { forgotPassword, resetPassword, verifyEmail, checkAuth } from '../controllers/user.js'
import { verifyToken } from '../middlewares/verifyToken.js';


const admin = express.Router();

admin.post("/register-admin", registerAdmin);
admin.post("/login-admin", loginAdmin);
admin.post('/verify-email', verifyEmail);
admin.post('/forgot-password', forgotPassword)
admin.post('/reset-password/:token', resetPassword);
admin.get('/check-auth', verifyToken, checkAuth);

export default admin;
