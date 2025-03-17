'use client';

import { useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import useWebSocket from '../hooks/useWebSocket';

// Define a custom intersection type to handle nullable fields
interface CustomIntersection {
    distance: number;
    point: THREE.Vector3;
    object: THREE.Object3D;
    face: THREE.Face | null;
    faceIndex: number | null;
    instanceId: number | null;
    uv: THREE.Vector2 | null;
    uv2: THREE.Vector2 | null;
}

const Box = () => {
    const meshRef = useRef<THREE.Mesh>(null);

    return (
        <mesh ref={meshRef} position={[0, 5, 0]} userData={{ type: 'box' }}>
            <boxGeometry args={[10, 10, 10]} />
            <meshStandardMaterial color="red" />
        </mesh>
    );
};

const Sphere = () => {
    const meshRef = useRef<THREE.Mesh>(null);

    return (
        <mesh ref={meshRef} position={[15, 5, 15]} userData={{ type: 'sphere' }}>
            <sphereGeometry args={[5, 32, 32]} />
            <meshStandardMaterial color="blue" />
        </mesh>
    );
};

const IntersectionMarker = ({ position }: { position: THREE.Vector3 }) => {
    const markerRef = useRef<THREE.Mesh>(null);

    useEffect(() => {
        if (markerRef.current) {
            // Mark this object to be excluded from raycasting
            markerRef.current.userData.isMarker = true;
            // Make it non-raycastable
            markerRef.current.raycast = () => { };
        }
    }, []);

    return (
        <mesh ref={markerRef} position={position} userData={{ isMarker: true }}>
            <sphereGeometry args={[0.3, 32, 32]} />
            <meshStandardMaterial color="#00ff00" transparent opacity={0.7} />
        </mesh>
    );
};

const MouseIntersection = () => {
    const { camera, scene } = useThree();
    const [intersection, setIntersection] = useState<CustomIntersection | null>(null);
    const raycaster = useRef(new THREE.Raycaster());
    const mouse = useRef(new THREE.Vector2());
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const { sendIntersectionUpdate, lastAcknowledgement } = useWebSocket();
    const [serverAckStatus, setServerAckStatus] = useState<string>("");

    // Get all meshes that should be interactive
    const getInteractiveMeshes = () => {
        const meshes: THREE.Object3D[] = [];
        scene.traverse((object) => {
            // Only include meshes with userData.type set (our custom objects)
            // Exclude any marker objects
            if (object instanceof THREE.Mesh &&
                object.userData.type &&
                !object.userData.isMarker) {
                meshes.push(object);
            }
        });
        return meshes;
    };

    // Update server ack status when we receive an acknowledgement
    useEffect(() => {
        if (lastAcknowledgement) {
            const timeDiff = Date.now() - lastAcknowledgement.timestamp;
            setServerAckStatus(`Server ack: ${timeDiff}ms ago`);
        }
    }, [lastAcknowledgement]);

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            // Calculate mouse position in normalized device coordinates
            mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;

            // Update the raycaster
            raycaster.current.setFromCamera(mouse.current, camera);

            // Get only the meshes we want to interact with
            const interactiveMeshes = getInteractiveMeshes();

            // Check for intersections with our interactive objects
            const meshIntersects = raycaster.current.intersectObjects(interactiveMeshes, false);

            let groundIntersectionPoint: THREE.Vector3 | null = null;

            if (meshIntersects.length > 0) {
                // We found an intersection with one of our interactive objects
                setIntersection(meshIntersects[0] as CustomIntersection);

                // Send the object intersection to the server
                sendIntersectionUpdate(meshIntersects[0], null);
            } else {
                // No object intersection, try the ground plane
                const intersectionPoint = new THREE.Vector3();
                const didIntersect = raycaster.current.ray.intersectPlane(groundPlane, intersectionPoint);

                if (didIntersect) {
                    groundIntersectionPoint = intersectionPoint.clone();
                    setIntersection({
                        distance: camera.position.distanceTo(intersectionPoint),
                        point: intersectionPoint,
                        object: new THREE.Object3D(), // Dummy object
                        face: null,
                        faceIndex: null,
                        instanceId: null,
                        uv: null,
                        uv2: null
                    });

                    // Send the ground intersection to the server
                    sendIntersectionUpdate(null, groundIntersectionPoint);
                } else {
                    setIntersection(null);

                    // Send no intersection to the server
                    sendIntersectionUpdate(null, null);
                }
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [camera, scene, sendIntersectionUpdate]);

    return (
        <>
            {intersection && <IntersectionMarker position={intersection.point} />}
            <Html fullscreen>
                {intersection && (
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '5px',
                        fontFamily: 'monospace',
                        zIndex: 1000
                    }}>
                        X: {intersection.point.x.toFixed(2)},
                        Y: {intersection.point.y.toFixed(2)},
                        Z: {intersection.point.z.toFixed(2)}
                        {intersection.object.userData?.type && (
                            <div>Object: {intersection.object.userData.type}</div>
                        )}
                        <div style={{ fontSize: '10px', color: '#00ff00' }}>{serverAckStatus}</div>
                    </div>
                )}
            </Html>
        </>
    );
};

const CameraController = () => {
    const { camera, gl } = useThree();
    const controlsRef = useRef<any>(null);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                // Reset camera position
                camera.position.set(30, 30, 30);
                camera.lookAt(0, 0, 0);
                if (controlsRef.current) {
                    controlsRef.current.reset();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [camera]);

    return <OrbitControls ref={controlsRef} enablePan={true} enableZoom={true} enableRotate={true} />;
};

const ThreeScene = () => {
    const { serverStatus, lastPong, sendPing, lastAcknowledgement } = useWebSocket();
    const [lastAckTime, setLastAckTime] = useState<string>('None');

    // Update the last acknowledgement time
    useEffect(() => {
        if (lastAcknowledgement) {
            setLastAckTime(new Date(lastAcknowledgement.timestamp).toLocaleTimeString());
        }
    }, [lastAcknowledgement]);

    // Send a ping every 5 seconds to keep the connection alive
    useEffect(() => {
        const pingInterval = setInterval(() => {
            sendPing();
        }, 5000);

        return () => clearInterval(pingInterval);
    }, [sendPing]);

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
            {/* WebSocket Status Indicator */}
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                zIndex: 1000,
                fontFamily: 'monospace',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                minWidth: '250px'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.3)',
                    paddingBottom: '5px'
                }}>
                    <span style={{ fontWeight: 'bold' }}>Server Status</span>
                    <span style={{
                        backgroundColor: serverStatus.connected ? 'rgba(0, 128, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '12px'
                    }}>
                        {serverStatus.connected ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                </div>

                <div>{serverStatus.message}</div>

                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Last Pong:</span>
                        <span>{lastPong ? new Date(lastPong.timestamp).toLocaleTimeString() : 'None'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Last Intersection Ack:</span>
                        <span>{lastAckTime}</span>
                    </div>
                </div>

                <button
                    onClick={sendPing}
                    style={{
                        backgroundColor: '#333',
                        border: 'none',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        marginTop: '5px'
                    }}
                >
                    Send Ping
                </button>
            </div>

            <Canvas camera={{ position: [30, 30, 30], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <Grid
                    args={[50, 50]}
                    cellSize={1}
                    cellThickness={0.5}
                    cellColor="#FFFF00"
                    sectionSize={5}
                    sectionThickness={1}
                    sectionColor="#FFFF00"
                    fadeDistance={100}
                    fadeStrength={1}
                    infiniteGrid={true}
                    position={[0, 0, 0]}
                    rotation={[0, 0, 0]}
                    renderOrder={-1}
                    side={THREE.DoubleSide}
                />
                <Box />
                <Sphere />
                <CameraController />
                <MouseIntersection />
            </Canvas>
        </div>
    );
};

export default ThreeScene; 