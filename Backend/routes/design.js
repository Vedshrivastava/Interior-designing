import express from 'express';
import { addDesign, listDesigns, removeDesign, appointments } from '../controllers/design.js';
import multer from 'multer';

const designRouter = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => {
        return cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

designRouter.post('/add', upload.array('images', 10), addDesign);  

designRouter.get('/list', listDesigns);

designRouter.delete('/remove', removeDesign);

designRouter.get('/orders', appointments)

export default designRouter;
