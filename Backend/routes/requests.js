import express from 'express';
import { masterAuthMiddleware, adminAuthMiddleware } from '../middlewares/auth.js';
import { submitRequest, listRequests, approveRequest, rejectRequest, deleteRequest, myRequestStatus } from '../controllers/requests.js';

const requestsRouter = express.Router();

// Public — anyone can submit
requestsRouter.post('/submit', submitRequest);

// Any logged-in user — check their own request status
requestsRouter.get('/my-status', adminAuthMiddleware, myRequestStatus);

// MASTER only
requestsRouter.get('/list',      masterAuthMiddleware, listRequests);
requestsRouter.post('/approve',  masterAuthMiddleware, approveRequest);
requestsRouter.post('/reject',   masterAuthMiddleware, rejectRequest);
requestsRouter.delete('/delete', masterAuthMiddleware, deleteRequest);

export default requestsRouter;
