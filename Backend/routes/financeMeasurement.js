import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listMeasurements, addMeasurement, updateMeasurement, removeMeasurement } from '../controllers/financeMeasurement.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listMeasurements);
router.post('/add',    adminAuthMiddleware, addMeasurement);
router.post('/update', adminAuthMiddleware, updateMeasurement);
router.delete('/remove', adminAuthMiddleware, removeMeasurement);

export default router;
