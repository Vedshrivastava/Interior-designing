import express from 'express';
import { listAppointments, addAppointment, updateStatus, addQuote, listQuotes } from '../controllers/appointments.js';
import { adminAuthMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/list', adminAuthMiddleware, listAppointments); 

router.post('/add', addAppointment); 

router.post('/quote', addQuote); 

router.get('/list-quotes', adminAuthMiddleware, listQuotes); 

router.post('/status', adminAuthMiddleware, updateStatus)

export default router;
