'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';

interface ServerStatus {
    connected: boolean;
    message: string;
}

interface PongResponse {
    timestamp: number;
    message: string;
}

interface IntersectionAcknowledgement {
    received: boolean;
    timestamp: number;
}

// Define the intersection data types
export interface IntersectionData {
    type: 'none' | 'ground' | 'object';
    position?: { x: number; y: number; z: number };
    objectType?: string;
    distance?: number;
    timestamp: number;
}

export const useWebSocket = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [serverStatus, setServerStatus] = useState<ServerStatus>({
        connected: false,
        message: 'Disconnected'
    });
    const [lastPong, setLastPong] = useState<PongResponse | null>(null);
    const [lastAcknowledgement, setLastAcknowledgement] = useState<IntersectionAcknowledgement | null>(null);

    // Initialize socket connection
    useEffect(() => {
        // Connect to the WebSocket server
        const socketInstance = io('http://localhost:3001');

        // Set up event listeners
        socketInstance.on('connect', () => {
            // Connection established
        });

        socketInstance.on('disconnect', () => {
            setServerStatus({
                connected: false,
                message: 'Disconnected from server'
            });
        });

        socketInstance.on('serverStatus', (status: ServerStatus) => {
            setServerStatus(status);
        });

        socketInstance.on('pong', (response: PongResponse) => {
            setLastPong(response);
        });

        socketInstance.on('intersectionAcknowledged', (ack: IntersectionAcknowledgement) => {
            setLastAcknowledgement(ack);
        });

        // Save socket instance
        setSocket(socketInstance);

        // Clean up on unmount
        return () => {
            socketInstance.disconnect();
        };
    }, []);

    // Function to send ping to server
    const sendPing = useCallback(() => {
        if (socket && socket.connected) {
            socket.emit('ping', { timestamp: Date.now() });
        }
    }, [socket]);

    // Function to send intersection data to server
    const sendIntersectionUpdate = useCallback((intersection: THREE.Intersection | null, groundPoint: THREE.Vector3 | null) => {
        if (!socket || !socket.connected) return;

        let data: IntersectionData;

        if (intersection && intersection.object.userData.type) {
            // Object intersection
            data = {
                type: 'object',
                position: {
                    x: intersection.point.x,
                    y: intersection.point.y,
                    z: intersection.point.z
                },
                objectType: intersection.object.userData.type,
                distance: intersection.distance,
                timestamp: Date.now()
            };
        } else if (groundPoint) {
            // Ground intersection
            data = {
                type: 'ground',
                position: {
                    x: groundPoint.x,
                    y: groundPoint.y,
                    z: groundPoint.z
                },
                timestamp: Date.now()
            };
        } else {
            // No intersection
            data = {
                type: 'none',
                timestamp: Date.now()
            };
        }

        socket.emit('intersectionUpdate', data);
    }, [socket]);

    return {
        socket,
        serverStatus,
        lastPong,
        lastAcknowledgement,
        sendPing,
        sendIntersectionUpdate
    };
};

export default useWebSocket; 