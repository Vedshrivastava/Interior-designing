import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { listMeasurements, addMeasurement, updateMeasurement, removeMeasurement } from '../controllers/financeMeasurement.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

router.get('/list',    adminAuthMiddleware, listMeasurements);
router.post('/add',    adminAuthMiddleware, upload.array('photos', 6), addMeasurement);
router.post('/update', adminAuthMiddleware, updateMeasurement);
router.delete('/remove', adminAuthMiddleware, removeMeasurement);

export default router;
