import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listProductSubcategories, addProductSubcategory, removeProductSubcategory, reorderProductSubcategories } from '../controllers/productSubcategory.js';

const router = express.Router();

router.get('/list',     listProductSubcategories);
router.post('/add',     adminAuthMiddleware, addProductSubcategory);
router.post('/remove',  adminAuthMiddleware, removeProductSubcategory);
router.post('/reorder', adminAuthMiddleware, reorderProductSubcategories);

export default router;
