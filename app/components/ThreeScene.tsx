'use client';

import { useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';

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
    const [debugInfo, setDebugInfo] = useState<string>("");
    const raycaster = useRef(new THREE.Raycaster());
    const mouse = useRef(new THREE.Vector2());
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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

            // For debugging - show all intersections
            const allIntersects = raycaster.current.intersectObjects(scene.children, true);
            if (allIntersects.length > 0) {
                const firstObj = allIntersects[0].object;
                setDebugInfo(`First hit: ${firstObj.type}, name: ${firstObj.name || 'unnamed'}, isMarker: ${!!firstObj.userData.isMarker}`);
            } else {
                setDebugInfo("No intersections");
            }

            if (meshIntersects.length > 0) {
                // We found an intersection with one of our interactive objects
                setIntersection(meshIntersects[0] as CustomIntersection);
            } else {
                // No object intersection, try the ground plane
                const intersectionPoint = new THREE.Vector3();
                const didIntersect = raycaster.current.ray.intersectPlane(groundPlane, intersectionPoint);

                if (didIntersect) {
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
                } else {
                    setIntersection(null);
                }
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [camera, scene]);

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
                        <div style={{ fontSize: '10px', opacity: 0.7 }}>{debugInfo}</div>
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
    return (
        <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
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