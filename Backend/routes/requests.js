import express from 'express';
import { masterAuthMiddleware } from '../middlewares/auth.js';
import { submitRequest, listRequests, approveRequest, rejectRequest } from '../controllers/requests.js';

const requestsRouter = express.Router();

// Public — anyone can submit
requestsRouter.post('/submit', submitRequest);

// MASTER only
requestsRouter.get('/list',    masterAuthMiddleware, listRequests);
requestsRouter.post('/approve', masterAuthMiddleware, approveRequest);
requestsRouter.post('/reject',  masterAuthMiddleware, rejectRequest);

export default requestsRouter;
