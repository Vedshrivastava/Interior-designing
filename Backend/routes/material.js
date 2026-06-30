import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listMaterials, addMaterial, removeMaterial, reorderMaterials } from '../controllers/material.js';

const router = express.Router();

router.get('/list',     listMaterials);
router.post('/add',     adminAuthMiddleware, addMaterial);
router.post('/remove',  adminAuthMiddleware, removeMaterial);
router.post('/reorder', adminAuthMiddleware, reorderMaterials);

export default router;
