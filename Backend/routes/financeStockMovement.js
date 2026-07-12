import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listStockMovements, addStockMovement, removeStockMovement, getCurrentStock } from '../controllers/financeStockMovement.js';

const router = express.Router();

router.get('/current-stock', adminAuthMiddleware, getCurrentStock);
router.get('/list',          adminAuthMiddleware, listStockMovements);
router.post('/add',          adminAuthMiddleware, addStockMovement);
router.delete('/remove',     adminAuthMiddleware, removeStockMovement);

export default router;
