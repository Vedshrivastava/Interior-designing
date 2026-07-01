import express from 'express'
import { forgotPassword, resetPassword, verifyEmail, checkAuth, verifyResetToken, resendVerification } from '../controllers/user.js'
import { verifyToken } from '../middlewares/verifyToken.js';


const user = express.Router();

user.post('/verify-email', verifyEmail);
user.post('/forgot-password', forgotPassword)
user.post('/reset-password/:token', resetPassword);
user.get('/check-auth', verifyToken, checkAuth);
user.get('/verify-reset-token/:token', verifyResetToken);
user.post('/resend-verification', resendVerification);


export default user;