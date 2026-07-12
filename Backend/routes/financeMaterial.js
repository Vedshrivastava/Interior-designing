import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceMaterials, addFinanceMaterial, updateFinanceMaterial, removeFinanceMaterial } from '../controllers/financeMaterial.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listFinanceMaterials);
router.post('/add',    adminAuthMiddleware, addFinanceMaterial);
router.post('/update', adminAuthMiddleware, updateFinanceMaterial);
router.post('/remove', adminAuthMiddleware, removeFinanceMaterial);

export default router;
