import express from 'express';
import rateLimit from 'express-rate-limit';
import { listAppointments, addAppointment, updateStatus, addQuote, listQuotes } from '../controllers/appointments.js';
import { adminAuthMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// 5 submissions per IP per 15 minutes — stops burst spam/bots
const appointmentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many submissions. Please try again in a few minutes.' },
});

// Honeypot check — real users leave `website` blank; bots fill it
const rejectHoneypot = (req, res, next) => {
    if (req.body.website) {
        return res.status(200).json({ success: true }); // silent fake success, don't tip off bots
    }
    next();
};

router.get('/list', adminAuthMiddleware, listAppointments);

router.post('/add',   appointmentLimiter, rejectHoneypot, addAppointment);
router.post('/quote', appointmentLimiter, rejectHoneypot, addQuote);

router.get('/list-quotes', adminAuthMiddleware, listQuotes);
router.post('/status', adminAuthMiddleware, updateStatus);

export default router;
