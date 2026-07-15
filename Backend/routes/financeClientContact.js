import express from 'express';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listClientContacts, addClientContact, updateClientContact, removeClientContact } from '../controllers/financeClientContact.js';

const router = express.Router();

router.get('/list',    adminAuthMiddleware, listClientContacts);
router.post('/add',    adminAuthMiddleware, addClientContact);
router.post('/update', adminAuthMiddleware, updateClientContact);
router.post('/remove', adminAuthMiddleware, removeClientContact);

export default router;
