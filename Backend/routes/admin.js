import express from "express";
import { registerAdmin, loginAdmin, changePassword, changeEmail, listAdmins, removeAdmin } from "../controllers/admin.js";
import { forgotPassword, resetPassword, verifyEmail, checkAuth, verifyResetToken } from '../controllers/user.js';
import { adminAuthMiddleware, masterAuthMiddleware } from '../middlewares/auth.js';
import { verifyToken } from '../middlewares/verifyToken.js';


const admin = express.Router();

admin.post("/register-admin", registerAdmin);
admin.post("/login-admin", loginAdmin);
admin.post('/verify-email', verifyEmail);
admin.post('/forgot-password', forgotPassword)
admin.post('/reset-password/:token', resetPassword);
admin.get('/check-auth', verifyToken, checkAuth);
admin.get('/verify-reset-token/:token', verifyResetToken);
admin.post('/change-password', adminAuthMiddleware, changePassword);
admin.post('/change-email',    adminAuthMiddleware, changeEmail);
admin.get('/list-admins',      masterAuthMiddleware, listAdmins);
admin.post('/remove-admin',    masterAuthMiddleware, removeAdmin);

export default admin;
