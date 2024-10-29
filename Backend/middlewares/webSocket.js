import { WebSocketServer } from 'ws';
import appointmentModel from "../models/appointments.js";

// Initialize WebSocket server
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // Optional: Handle messages from clients if needed
    ws.on('message', (message) => {
        console.log(`Received message => ${message}`);
    });

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
    });
});

// Broadcast function to send data to all connected clients
const broadcast = (data) => {
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

export { wss, broadcast };
