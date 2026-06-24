import express from 'express';
import multer from 'multer';
import { adminAuthMiddleware } from '../middlewares/auth.js';
import { addProduct, listProducts, removeProduct, updateProduct } from '../controllers/product.js';

const productRouter = express.Router();

const storage = multer.diskStorage({
    destination: 'uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Public
productRouter.get('/list', listProducts);

// Protected
productRouter.post('/add',    adminAuthMiddleware, upload.array('images', 10), addProduct);
productRouter.post('/update', adminAuthMiddleware, upload.array('images', 10), updateProduct);
productRouter.delete('/remove', adminAuthMiddleware, removeProduct);

export default productRouter;
