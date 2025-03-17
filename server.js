const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');

// Create Express app for HTTP API endpoints
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server using the Express app
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3001;

// Store only the latest intersection state across all clients
let latestIntersectionState = { type: 'none' };
let latestClientId = null;

// Define the initial scene state with default objects
const sceneState = {
    objects: [
        {
            id: 'box1',
            type: 'box',
            position: [0, 5, 0],
            size: [10, 10, 10],
            color: 'red'
        },
        {
            id: 'sphere1',
            type: 'sphere',
            position: [15, 5, 15],
            radius: 5,
            segments: [32, 32],
            color: 'blue'
        }
    ]
};

// MCP API Endpoints for AI agents
app.get('/api/scene', (req, res) => {
    res.json(sceneState);
});

app.get('/api/pointer', (req, res) => {
    res.json({
        pointer: latestIntersectionState,
        clientId: latestClientId,
        timestamp: Date.now()
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        latestClientId: latestClientId,
        timestamp: Date.now()
    });
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send a welcome message to the client
    socket.emit('serverStatus', { connected: true, message: 'Connected to server' });

    // Send the current scene state to the newly connected client
    socket.emit('sceneState', sceneState);
    console.log(`Sent scene state to client ${socket.id}`);

    // Handle ping messages
    socket.on('ping', (data) => {
        // Silently process ping without logging
        socket.emit('pong', { timestamp: Date.now(), message: 'Server pong response' });
    });

    // Handle intersection updates
    socket.on('intersectionUpdate', (data) => {
        // Store the updated intersection state as the latest one
        latestIntersectionState = data;
        latestClientId = socket.id;

        // Log the intersection data
        if (data.type === 'none') {
            console.log(`Client ${socket.id} is not pointing at anything`);
        } else if (data.type === 'ground') {
            console.log(`Client ${socket.id} is pointing at the ground at position:`, data.position);
        } else if (data.type === 'object') {
            console.log(`Client ${socket.id} is pointing at object "${data.objectType}" at position:`, data.position);
        }

        // Acknowledge receipt of the data
        socket.emit('intersectionAcknowledged', {
            received: true,
            timestamp: Date.now()
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);

        // If this was the latest client to update intersection, reset the state
        if (socket.id === latestClientId) {
            latestIntersectionState = { type: 'none' };
            latestClientId = null;
        }
    });
});

server.listen(PORT, () => {
    console.log(`MCP server running on port ${PORT}`);
    console.log(`- WebSocket server available at ws://localhost:${PORT}`);
    console.log(`- HTTP API available at http://localhost:${PORT}/api`);
}); 