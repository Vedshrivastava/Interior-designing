import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware, masterAuthMiddleware } from '../middlewares/auth.js';
import {
    getCompanySettings, updateCompanySettings,
    getNotificationSettings, updateNotificationSettings,
    getPermissions, updatePermissions,
    checkAlerts, exportBackup,
} from '../controllers/financeCompanySettings.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Same sensitivity split as the rest of company-wide config: GET readable
// by any admin, PUT (a real change) restricted to MASTER.
router.get('/company', adminAuthMiddleware, getCompanySettings);
router.put('/company', masterAuthMiddleware, upload.single('logo'), updateCompanySettings);

router.get('/notifications', adminAuthMiddleware, getNotificationSettings);
router.put('/notifications', masterAuthMiddleware, updateNotificationSettings);

router.get('/permissions', masterAuthMiddleware, getPermissions);
router.put('/permissions', masterAuthMiddleware, updatePermissions);

router.get('/check-alerts', adminAuthMiddleware, checkAlerts);

router.get('/backup/export', masterAuthMiddleware, exportBackup);

export default router;
