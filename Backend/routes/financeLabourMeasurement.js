import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listLabourMeasurements, addLabourMeasurement, updateLabourMeasurement, removeLabourMeasurement } from '../controllers/financeLabourMeasurement.js';

const router = express.Router();

router.get('/list',      adminAuthMiddleware, listLabourMeasurements);
router.post('/add',      adminAuthMiddleware, addLabourMeasurement);
router.post('/update',   adminAuthMiddleware, updateLabourMeasurement);
router.post('/remove',   adminAuthMiddleware, removeLabourMeasurement);

export default router;
