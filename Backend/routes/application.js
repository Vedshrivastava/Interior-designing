import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listApplications, addApplication, removeApplication, reorderApplications } from '../controllers/application.js';

const router = express.Router();

router.get('/list',     listApplications);
router.post('/add',     adminAuthMiddleware, addApplication);
router.post('/remove',  adminAuthMiddleware, removeApplication);
router.post('/reorder', adminAuthMiddleware, reorderApplications);

export default router;
