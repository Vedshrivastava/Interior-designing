import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listProductCategories, addProductCategory, removeProductCategory, reorderProductCategories } from '../controllers/productCategory.js';

const router = express.Router();

router.get('/list',     listProductCategories);
router.post('/add',     adminAuthMiddleware, addProductCategory);
router.post('/remove',  adminAuthMiddleware, removeProductCategory);
router.post('/reorder', adminAuthMiddleware, reorderProductCategories);

export default router;
