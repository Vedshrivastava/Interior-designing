import express from 'express';
import { listCategories, addCategory, removeCategory } from '../controllers/category.js';
import { adminAuthMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/list', listCategories);
router.post('/add',    adminAuthMiddleware, addCategory);
router.post('/remove', adminAuthMiddleware, removeCategory);

export default router;
