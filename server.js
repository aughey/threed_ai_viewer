const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3001;

// Store the current intersection state for each client
const clientIntersectionState = new Map();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Initialize the client's intersection state
    clientIntersectionState.set(socket.id, { type: 'none' });

    // Send a welcome message to the client
    socket.emit('serverStatus', { connected: true, message: 'Connected to server' });

    // Handle ping messages
    socket.on('ping', (data) => {
        // Silently process ping without logging
        socket.emit('pong', { timestamp: Date.now(), message: 'Server pong response' });
    });

    // Handle intersection updates
    socket.on('intersectionUpdate', (data) => {
        // Store the updated intersection state
        clientIntersectionState.set(socket.id, data);

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
        // Clean up the client's intersection state
        clientIntersectionState.delete(socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
}); 