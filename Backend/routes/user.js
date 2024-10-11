import express from 'express'
import { forgotPassword, loginUser, registerUser, resetPassword, verifyEmail, checkAuth } from '../controllers/user.js'
import { verifyToken } from '../middlewares/verifyToken.js';
import { authMiddleware } from '../middlewares/auth.js';


const user = express.Router();

user.post('/register', registerUser);
user.post('/login', loginUser);
user.post('/verify-email', verifyEmail);
user.post('/forgot-password', forgotPassword)
user.post('/reset-password/:token', resetPassword);
user.get('/check-auth', verifyToken, checkAuth);

export default user;