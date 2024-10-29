import express from "express";
import cors from "cors";
import http from "http"; // Import http to create the server
import { connectDB } from './config/db.js';
import designRouter from "./routes/design.js";
import router from "./routes/appointments.js";
import admin from "./routes/admin.js";
import user from "./routes/user.js";
import dotenv from 'dotenv';
import { wss } from './middlewares/webSocket.js'; // Import WebSocket server setup

dotenv.config();

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Connect to the database
connectDB(process.env.MONGO_URI);

// Routes
app.use('/api/design', designRouter);
app.use('/api/appointment', router);
app.use('/api/admin', admin);
app.use('/api/user', user);

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
