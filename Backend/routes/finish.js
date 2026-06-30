import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinishes, addFinish, removeFinish, reorderFinishes } from '../controllers/finish.js';

const router = express.Router();

router.get('/list',     listFinishes);
router.post('/add',     adminAuthMiddleware, addFinish);
router.post('/remove',  adminAuthMiddleware, removeFinish);
router.post('/reorder', adminAuthMiddleware, reorderFinishes);

export default router;
