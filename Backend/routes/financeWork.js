import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listWorks, addWork, updateWork, removeWork } from '../controllers/financeWork.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listWorks);
router.post('/add',    adminAuthMiddleware, addWork);
router.post('/update', adminAuthMiddleware, updateWork);
router.post('/remove', adminAuthMiddleware, removeWork);

export default router;
