"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useState } from "react";
import * as THREE from "three";
import {
  ArchitectureNode,
  ArchitectureEdge,
  positions,
} from "@/lib/architecture";
const colors: Record<string, string> = {
  change: "#9486d9",
  shared: "#c6baf1",
  risk: "#d59b65",
  verified: "#6fb49b",
};
function Focus({
  selected,
  points,
}: {
  selected: number;
  points: [number, number, number][];
}) {
  useFrame(({ camera, invalidate }) => {
    const target = new THREE.Vector3(...(points[selected] || [0, 0, 0]));
    const desired = new THREE.Vector3(
      target.x * 0.22,
      target.y * 0.22 + 0.7,
      points.length > 11 ? 9.2 : 7.2,
    );
    camera.position.lerp(desired, 0.1);
    camera.lookAt(target.multiplyScalar(0.18));
    if (camera.position.distanceTo(desired) > 0.005) invalidate();
  });
  return null;
}
function Connection({
  a,
  b,
  risk,
}: {
  a: [number, number, number];
  b: [number, number, number];
  risk: boolean;
}) {
  const start = new THREE.Vector3(...a),
    end = new THREE.Vector3(...b),
    direction = end.clone().sub(start);
  return (
    <mesh
      position={start.add(end).multiplyScalar(0.5)}
      quaternion={new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize(),
      )}
    >
      <cylinderGeometry args={[0.009, 0.009, direction.length(), 5]} />
      <meshStandardMaterial
        color={risk ? "#bd8d64" : "#555875"}
        roughness={0.7}
      />
    </mesh>
  );
}
export default function Scene({
  nodes,
  edges,
  selected,
  onSelect,
}: {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [hover, setHover] = useState(-1);
  const points = positions(nodes);
  return (
    <>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.7, points.length > 11 ? 9.2 : 7.2], fov: 40 }}
        aria-label="Selectable code architecture; equivalent module controls follow"
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 5, 5]} intensity={3} />
        <pointLight position={[-4, -2, 4]} color="#8c83bd" intensity={18} />
        <Focus selected={selected} points={points} />
        <group rotation={[0.12, -0.18, -0.04]}>
          {edges.slice(0, 90).map((edge, i) => {
            const a = nodes.findIndex((n) => n.id === edge.source),
              b = nodes.findIndex((n) => n.id === edge.target);
            return a >= 0 && b >= 0 ? (
              <Connection
                key={i}
                a={points[a]}
                b={points[b]}
                risk={nodes[b].status === "risk"}
              />
            ) : null;
          })}
          {nodes.map((node, i) => (
            <group position={points[i]} key={node.id}>
              <mesh
                rotation={[
                  0.08,
                  0.25,
                  node.kind === "pull-request" ? Math.PI / 4 : 0,
                ]}
                scale={selected === i ? 1.15 : hover === i ? 1.08 : 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(i);
                }}
                onPointerOver={() => setHover(i)}
                onPointerOut={() => setHover(-1)}
              >
                {node.kind === "database" ? (
                  <cylinderGeometry args={[0.32, 0.32, 0.7, 24]} />
                ) : node.kind === "function" || node.kind === "interface" ? (
                  <octahedronGeometry args={[0.43]} />
                ) : node.kind === "repository" ? (
                  <icosahedronGeometry args={[0.68, 0]} />
                ) : (
                  <boxGeometry
                    args={[
                      0.55,
                      node.kind === "file" ? 0.72 : 0.45,
                      node.kind === "file" ? 0.12 : 0.4,
                    ]}
                  />
                )}
                <meshStandardMaterial
                  color={
                    colors[node.status || ""] ||
                    (i === 0 ? "#b5a5de" : "#646b80")
                  }
                  metalness={0.3}
                  roughness={0.34}
                  emissive={selected === i ? "#49405d" : "#000000"}
                />
              </mesh>
              {i === 0 && (
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
                  <torusGeometry args={[0.85, 0.018, 6, 48]} />
                  <meshStandardMaterial color="#9386b5" />
                </mesh>
              )}
            </group>
          ))}
        </group>
      </Canvas>
      {hover >= 0 && (
        <span className="module-hover">
          {nodes[hover].kind} / {nodes[hover].label}
        </span>
      )}
    </>
  );
}
