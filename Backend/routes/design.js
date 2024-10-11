import express from 'express';
import { addDesign, listDesigns, removeDesign, appointments } from '../controllers/design.js';
import multer from 'multer';
import {adminAuthMiddleware} from '../middlewares/auth.js'

const designRouter = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => {
        return cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

designRouter.post('/add',adminAuthMiddleware, upload.array('images', 10), addDesign);  

designRouter.get('/list', listDesigns);

designRouter.delete('/remove', adminAuthMiddleware, removeDesign);

designRouter.get('/orders', adminAuthMiddleware, appointments)

export default designRouter;
