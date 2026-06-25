import express from 'express';
import { masterAuthMiddleware } from '../middlewares/auth.js';
import { listBin, restoreItem, permanentDelete } from '../controllers/recovery.js';

const recoveryRouter = express.Router();

recoveryRouter.get('/bin',          masterAuthMiddleware, listBin);
recoveryRouter.post('/restore',     masterAuthMiddleware, restoreItem);
recoveryRouter.delete('/permanent', masterAuthMiddleware, permanentDelete);

export default recoveryRouter;
