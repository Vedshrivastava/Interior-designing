import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listSpecialities, addSpeciality, removeSpeciality, reorderSpecialities } from '../controllers/speciality.js';

const router = express.Router();

router.get('/list',     listSpecialities);
router.post('/add',     adminAuthMiddleware, addSpeciality);
router.post('/remove',  adminAuthMiddleware, removeSpeciality);
router.post('/reorder', adminAuthMiddleware, reorderSpecialities);

export default router;
