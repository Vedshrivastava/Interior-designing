import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listSupervisorLabourPayments, addSupervisorLabourPayment, removeSupervisorLabourPayment } from '../controllers/financeSupervisorLabourPayment.js';

const router = express.Router();

router.get('/list', adminAuthMiddleware, listSupervisorLabourPayments);
router.post('/add', adminAuthMiddleware, addSupervisorLabourPayment);
router.delete('/remove', adminAuthMiddleware, removeSupervisorLabourPayment);

export default router;
