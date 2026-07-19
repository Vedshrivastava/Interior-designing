import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listReviewsForProject, reviewWork } from '../controllers/financeWorkReview.js';

const router = express.Router();

router.get('/project/:projectId', adminAuthMiddleware, listReviewsForProject);
router.post('/review', adminAuthMiddleware, reviewWork);

export default router;
