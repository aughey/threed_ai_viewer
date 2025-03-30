const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { z } = require('zod');

// Create Express app
const app = express();
app.use(express.json());

// Helper function to extract session ID from request
function getSessionId(req) {
    return req.query.sessionId ||
        req.headers['x-session-id'] ||
        (req.body && req.body.sessionId) ||
        req.cookies?.sessionId ||
        Date.now().toString();
}

// Session ID middleware
app.use((req, res, next) => {
    // Skip for static files
    if (req.path.startsWith('/static')) {
        return next();
    }

    // Extract and normalize the session ID
    const sessionId = getSessionId(req);

    // Store it consistently in request object for later use
    req.sessionId = sessionId;

    // Add it to response headers for client reference
    res.setHeader('X-Session-ID', sessionId);

    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');

    // Log request details for debugging
    console.log(`${req.method} ${req.path} - Session ID: ${sessionId}`);

    next();
});

// Handle CORS preflight requests
app.options('*', (_req, res) => {
    res.status(200).end();
});

// Create MCP server
const mcpServer = new McpServer({
    name: "3D-Scene-Server",
    version: "1.0.0"
});

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

// Store only the latest intersection state across all clients
let latestIntersectionState = { type: 'none' };
let latestClientId = null;

// State management functions (Redux-like approach)
function setScene(newState) {
    // Update the scene state
    Object.assign(sceneState, newState);

    // Broadcast to all WebSocket clients
    io.emit('sceneState', sceneState);
    console.log('Scene state updated and broadcasted to all clients');

    // Return the updated state
    return sceneState;
}

function addObjects(objectsToAdd) {
    // Create a new state with the added objects
    const newState = {
        objects: [...sceneState.objects, ...objectsToAdd]
    };

    // Update and broadcast
    return setScene(newState);
}

function removeObjects(ids) {
    // Create a new state without the specified objects
    const newState = {
        objects: sceneState.objects.filter(obj => !ids.includes(obj.id))
    };

    // Update and broadcast
    return setScene(newState);
}

function updateObjects(objectUpdates) {
    // Create a new state with all updated objects
    const newState = {
        objects: sceneState.objects.map(obj => {
            // Find if this object has updates
            const updates = objectUpdates.find(update => update.id === obj.id);
            // If found, apply updates, otherwise return unchanged
            return updates ? { ...obj, ...updates } : obj;
        })
    };

    // Update and broadcast
    return setScene(newState);
}

// MCP Resources
mcpServer.resource(
    "scene",
    "scene://current",
    async (uri) => ({
        contents: [{
            uri: uri.href,
            text: JSON.stringify(sceneState, null, 2)
        }]
    })
);

mcpServer.resource(
    "pointer",
    "pointer://current",
    async (uri) => ({
        contents: [{
            uri: uri.href,
            text: JSON.stringify({
                pointer: latestIntersectionState,
                clientId: latestClientId,
                timestamp: Date.now()
            }, null, 2)
        }]
    })
);

// New tool to add multiple objects at once
mcpServer.tool(
    "add-objects",
    "Adds multiple objects to the scene, you must define the type, id, position (array of 3 numbers), color.  radius for spheres, size for boxes (array of 3 numbers).",
    {
        objects: z.array(
            z.object({
                type: z.enum(['box', 'sphere']),
                id: z.string(),
                position: z.array(z.number()).length(3),
                color: z.string(),
                // For box
                size: z.array(z.number()).length(3).optional(),
                // For sphere
                radius: z.number().optional(),
                segments: z.array(z.number()).length(2).optional()
            })
        )
    },
    async (params) => {
        console.log('[DEBUG] add-objects tool called with params:', JSON.stringify(params, null, 2));
        const { objects } = params;

        // Validate that none of the object IDs already exist
        const existingIds = [];
        for (const obj of objects) {
            const existingIndex = sceneState.objects.findIndex(existing => existing.id === obj.id);
            if (existingIndex >= 0) {
                existingIds.push(obj.id);
            }
        }

        if (existingIds.length > 0) {
            const response = {
                content: [{
                    type: "text",
                    text: `Error: Objects with IDs "${existingIds.join('", "')}" already exist`
                }],
                isError: true
            };
            console.log('[DEBUG] add-objects error response:', JSON.stringify(response, null, 2));
            return response;
        }

        // Add all objects to the scene state
        addObjects(objects);

        const response = {
            content: [{
                type: "text",
                text: `Successfully added ${objects.length} objects to the scene`
            }]
        };
        console.log('[DEBUG] add-objects success response:', JSON.stringify(response, null, 2));
        return response;
    }
);

mcpServer.tool(
    "remove-objects",
    "Removes multiple objects from the scene",
    {
        ids: z.array(z.string())
    },
    async ({ ids }) => {
        const initialLength = sceneState.objects.length;

        // Remove objects using our state management function
        const updatedState = removeObjects(ids);

        if (updatedState.objects.length === initialLength) {
            return {
                content: [{
                    type: "text",
                    text: `Error: None of the objects with IDs "${ids.join('", "')}" were found`
                }],
                isError: true
            };
        }

        const removedCount = initialLength - updatedState.objects.length;

        return {
            content: [{
                type: "text",
                text: `Successfully removed ${removedCount} object(s) with IDs "${ids.join('", "')}"`
            }]
        };
    }
);

mcpServer.tool(
    "update-objects",
    "Updates multiple objects in the scene",
    {
        objects: z.array(
            z.object({
                id: z.string(),
                position: z.array(z.number()).length(3).optional(),
                color: z.string().optional(),
                // For box
                size: z.array(z.number()).length(3).optional(),
                // For sphere
                radius: z.number().optional(),
                segments: z.array(z.number()).length(2).optional()
            })
        )
    },
    async (params) => {
        const { objects } = params;

        // Validate that all object IDs exist
        const objectIds = objects.map(obj => obj.id);
        const existingIds = sceneState.objects.filter(obj => objectIds.includes(obj.id)).map(obj => obj.id);
        const missingIds = objectIds.filter(id => !existingIds.includes(id));

        if (missingIds.length > 0) {
            return {
                content: [{
                    type: "text",
                    text: `Error: Objects with IDs "${missingIds.join('", "')}" not found`
                }],
                isError: true
            };
        }

        // Update objects properties using our state management function
        updateObjects(objects);

        return {
            content: [{
                type: "text",
                text: `Successfully updated ${objects.length} object(s)`
            }]
        };
    }
);

mcpServer.tool(
    "get-all-objects",
    "Gets all objects in the scene",
    {},
    async () => {
        const response = {
            content: [{
                type: "text",
                text: JSON.stringify(sceneState.objects, null, 2)
            }]
        };
        console.log('[DEBUG] get-all-objects response:', JSON.stringify(response, null, 2));
        return response;
    }
);

// New tool to get pointer intersection information
mcpServer.tool(
    "get-pointer",
    "Gets pointer intersection information",
    {},
    async () => {
        // Return the latest intersection state
        const pointerInfo = {
            type: latestIntersectionState.type,
            clientId: latestClientId,
            timestamp: Date.now()
        };

        // Add position if available
        if (latestIntersectionState.position) {
            pointerInfo.position = latestIntersectionState.position;
        }

        // Add object information if pointing at an object
        if (latestIntersectionState.type === 'object') {
            pointerInfo.objectId = latestIntersectionState.objectId;
            pointerInfo.objectType = latestIntersectionState.objectType;
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(pointerInfo, null, 2)
            }]
        };
    }
);

// Regular Express routes for WebSocket clients
app.get('/api/status', (_req, res) => {
    res.json({
        status: 'online',
        latestClientId: latestClientId,
        timestamp: Date.now()
    });
});

// Store transports by session ID
const transports = new Map();

// Set up MCP SSE endpoint
app.get("/mcp/sse", async (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const transport = new SSEServerTransport("/mcp/messages", res);
    const sessionId = transport.sessionId;

    console.log('[DEBUG] New SSE connection:', {
        sessionId,
        headers: res.getHeaders(),
        timestamp: new Date().toISOString()
    });

    transports.set(sessionId, transport);
    console.log(`[DEBUG] Active sessions: ${Array.from(transports.keys()).join(', ')}`);

    try {
        await mcpServer.connect(transport);
    } catch (error) {
        console.error('[DEBUG] SSE connection error:', error);
        res.end();
    }
});

// Set up MCP message endpoint
app.post("/mcp/messages", async (req, res) => {
    const sessionId = req.sessionId;
    console.log('[DEBUG] Received MCP message:', {
        sessionId,
        body: req.body,
        query: req.query,
        timestamp: new Date().toISOString()
    });

    let transport = transports.get(sessionId);

    if (!transport) {
        const errorResponse = {
            error: "No active MCP connection for this session",
            message: "Please establish an SSE connection first",
            providedSessionId: sessionId,
            availableSessions: Array.from(transports.keys())
        };
        console.log('[DEBUG] MCP message error:', errorResponse);
        return res.status(400).json(errorResponse);
    }

    try {
        await transport.handlePostMessage(req, res, req.body);
        console.log('[DEBUG] MCP message handled successfully');
    } catch (error) {
        console.error('[DEBUG] Error handling MCP message:', error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
});

// WebSocket setup for real-time clients
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
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
    socket.on('ping', (_data) => {
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
            console.log(`Client ${socket.id} is pointing at object "${data.objectId}" (${data.objectType}) at position:`, data.position);

            // Store additional object information in the intersection state
            if (!latestIntersectionState.objectId && data.objectId) {
                latestIntersectionState.objectId = data.objectId;
            }

            if (!latestIntersectionState.objectType && data.objectType) {
                latestIntersectionState.objectType = data.objectType;
            }
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`MCP server running on port ${PORT}`);
    console.log(`- WebSocket server available at ws://localhost:${PORT}`);
    console.log(`- HTTP API available at http://localhost:${PORT}/api`);
    console.log(`- MCP SSE endpoint available at http://localhost:${PORT}/mcp/sse`);
    console.log(`- MCP message endpoint available at http://localhost:${PORT}/mcp/messages`);
}); 