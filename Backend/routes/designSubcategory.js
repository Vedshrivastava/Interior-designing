import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listDesignSubcategories, addDesignSubcategory, removeDesignSubcategory, reorderDesignSubcategories } from '../controllers/designSubcategory.js';

const router = express.Router();

router.get('/list',     listDesignSubcategories);
router.post('/add',     adminAuthMiddleware, addDesignSubcategory);
router.post('/remove',  adminAuthMiddleware, removeDesignSubcategory);
router.post('/reorder', adminAuthMiddleware, reorderDesignSubcategories);

export default router;
