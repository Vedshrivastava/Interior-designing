import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listExpenses, addExpense, updateExpense, removeExpense } from '../controllers/financeExpense.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listExpenses);
router.post('/add',    adminAuthMiddleware, upload.single('attachment'), addExpense);
router.post('/update', adminAuthMiddleware, upload.single('attachment'), updateExpense);
router.delete('/remove', adminAuthMiddleware, removeExpense);

export default router;
