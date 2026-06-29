import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listProjectCategories, addProjectCategory, removeProjectCategory, reorderProjectCategories } from '../controllers/projectCategory.js';

const router = express.Router();

router.get('/list',    listProjectCategories);
router.post('/add',    adminAuthMiddleware, addProjectCategory);
router.post('/remove', adminAuthMiddleware, removeProjectCategory);
router.post('/reorder',adminAuthMiddleware, reorderProjectCategories);

export default router;
