import express from 'express';
import { listAppointments, addAppointment, updateStatus, addQuote, listQuotes } from '../controllers/appointments.js';

const router = express.Router();

router.get('/list', listAppointments); 

router.post('/add', addAppointment); 

router.post('/quote', addQuote); 

router.get('/list-quotes', listQuotes); 

router.post('/status', updateStatus)

export default router;
