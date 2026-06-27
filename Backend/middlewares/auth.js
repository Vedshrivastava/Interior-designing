import jwt from 'jsonwebtoken';
import userModel from '../models/user.js';

const adminAuthMiddleware = async (req, res, next) => {
    // Extract token from Authorization header
    const token = req.headers.authorization?.split(' ')[1];

    console.log("Received token for admin:", token);  // Log the token for debugging

    if (!token) {
        return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    try {
        // Verify the token using the admin secret key
        const decoded = jwt.verify(token, process.env.JWT_KEY_ADMIN);

        console.log("Decoded admin token payload:", decoded);  

        req.userId = decoded.id;
        req.userName = decoded.name;  
        req.userEmail = decoded.email;  

        console.log("Admin User ID from token:", req.userId);  

        next();  
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: "Token has expired. Please log in again." });
        }
        console.log('Admin token verification error:', error);
        res.status(401).json({ success: false, message: "Invalid token" });
    }
};

/* MASTER-only middleware — checks JWT role, falls back to DB if not in token */
const masterAuthMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Not Authorized' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_KEY_ADMIN);
        req.userId    = decoded.id;
        req.userName  = decoded.name;
        req.userEmail = decoded.email;

        let role = decoded.role;
        if (!role) {
            const user = await userModel.findById(decoded.id).select('role');
            role = user?.role;
        }

        if (role !== 'MASTER') {
            return res.status(403).json({ success: false, message: 'Master access required' });
        }
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError')
            return res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

export { adminAuthMiddleware, masterAuthMiddleware };
