import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listProjectTypes, addProjectType, removeProjectType, reorderProjectTypes } from '../controllers/projectType.js';

const router = express.Router();

router.get('/list',    listProjectTypes);
router.post('/add',    adminAuthMiddleware, addProjectType);
router.post('/remove', adminAuthMiddleware, removeProjectType);
router.post('/reorder',adminAuthMiddleware, reorderProjectTypes);

export default router;
