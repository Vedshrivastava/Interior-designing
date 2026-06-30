import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import http from "http"; // Import http to create the server
import { connectDB } from './config/db.js';
import designRouter from "./routes/design.js";
import projectRouter from "./routes/project.js";
import productRouter   from "./routes/product.js";
import requestsRouter     from "./routes/requests.js";
import testimonialRouter  from "./routes/testimonial.js";
import router from "./routes/appointments.js";
import admin from "./routes/admin.js";
import user from "./routes/user.js";
import recoveryRouter from "./routes/recovery.js";
import categoryRouter        from "./routes/category.js";
import projectCategoryRouter from "./routes/projectCategory.js";
import projectTypeRouter     from "./routes/projectType.js";
import specialityRouter      from "./routes/speciality.js";
import applicationRouter     from "./routes/application.js";
import productCategoryRouter    from "./routes/productCategory.js";
import productSubcategoryRouter from "./routes/productSubcategory.js";
import materialRouter from "./routes/material.js";
import finishRouter   from "./routes/finish.js";
import cityRouter     from "./routes/city.js";
import dotenv from 'dotenv';
import { wss } from './middlewares/webSocket.js'; // Import WebSocket server setup

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// CORS — manual headers, guaranteed to work
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// Connect to the database
connectDB(process.env.MONGO_URI);

// Rate limiting — public submission endpoints only
const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,                     // max 10 submissions per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
});
app.use('/api/appointment/add',      submissionLimiter);
app.use('/api/appointment/quote',    submissionLimiter);
app.use('/api/requests/submit',      submissionLimiter);

// Routes
app.use('/api/design', designRouter);
app.use('/api/project', projectRouter);
app.use('/api/product',   productRouter);
app.use('/api/requests',     requestsRouter);
app.use('/api/testimonial',  testimonialRouter);
app.use('/api/appointment', router);
app.use('/api/admin', admin);
app.use('/api/user', user);
app.use('/api/recovery', recoveryRouter);
app.use('/api/category',         categoryRouter);
app.use('/api/project-category', projectCategoryRouter);
app.use('/api/project-type',     projectTypeRouter);
app.use('/api/speciality',       specialityRouter);
app.use('/api/application',      applicationRouter);
app.use('/api/product-category',    productCategoryRouter);
app.use('/api/product-subcategory', productSubcategoryRouter);
app.use('/api/material', materialRouter);
app.use('/api/finish',   finishRouter);
app.use('/api/city',     cityRouter);

// Serve static files
app.use('/images', express.static('uploads'));

// Root route
app.get("/", (req, res) => {
    res.send("API Working");
});

// Create an HTTP server to allow WebSocket connections
const server = http.createServer(app);

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Start the server
server.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
