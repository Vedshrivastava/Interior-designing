import express from 'express';
import { listCategories, addCategory } from '../controllers/category.js';
import { adminAuthMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/list', listCategories);
router.post('/add', adminAuthMiddleware, addCategory);

export default router;
