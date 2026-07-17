import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listFinanceEmployees, addFinanceEmployee, updateFinanceEmployee, removeFinanceEmployee, addEmployeeDocument, removeEmployeeDocument } from '../controllers/financeEmployee.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listFinanceEmployees);
router.post('/add',    adminAuthMiddleware, addFinanceEmployee);
router.post('/update', adminAuthMiddleware, updateFinanceEmployee);
router.post('/remove', adminAuthMiddleware, removeFinanceEmployee);
router.post('/documents/add',    adminAuthMiddleware, upload.single('document'), addEmployeeDocument);
router.post('/documents/remove', adminAuthMiddleware, removeEmployeeDocument);

export default router;
