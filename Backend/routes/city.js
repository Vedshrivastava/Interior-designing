import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listCities, addCity, removeCity, reorderCities } from '../controllers/city.js';

const router = express.Router();

router.get('/list',     listCities);
router.post('/add',     adminAuthMiddleware, addCity);
router.post('/remove',  adminAuthMiddleware, removeCity);
router.post('/reorder', adminAuthMiddleware, reorderCities);

export default router;
