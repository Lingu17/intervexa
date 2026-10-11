"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Maximize2,
  Move,
} from "lucide-react";
import * as THREE from "three";
import {
  ArchitectureNode,
  ArchitectureEdge,
  positions,
} from "@/lib/architecture";
const palette: Record<string, string> = {
  change: "#ad8cff",
  shared: "#ceb6ff",
  risk: "#ffb96b",
  verified: "#77edc9",
};
function CameraRig({
  target,
  angle,
  distance,
}: {
  target: [number, number, number];
  angle: number;
  distance: number;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const focus = useMemo(
    () => new THREE.Vector3(target[0] * 0.22, 0.25, target[2] * 0.22),
    [target],
  );
  const position = useMemo(
    () =>
      new THREE.Vector3(
        Math.sin(angle) * distance,
        distance * 0.7,
        Math.cos(angle) * distance,
      ),
    [angle, distance],
  );
  useEffect(() => {
    invalidate();
  }, [invalidate, position, focus]);
  useFrame(({ camera, invalidate }) => {
    camera.position.lerp(position, 0.16);
    camera.lookAt(focus);
    if (camera.position.distanceTo(position) > 0.005) invalidate();
  });
  return null;
}
function Wire({
  a,
  b,
  color,
  active,
}: {
  a: [number, number, number];
  b: [number, number, number];
  color: string;
  active: boolean;
}) {
  const line = useMemo(() => {
    const middle = new THREE.Vector3(
      (a[0] + b[0]) / 2,
      Math.max(a[1], b[1]) + 0.8,
      (a[2] + b[2]) / 2,
    );
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...a),
      middle,
      new THREE.Vector3(...b),
    );
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(18)),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: active ? 0.8 : 0.25,
      }),
    );
  }, [a, b, color, active]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}
function Module({
  node,
  active,
  hover,
  onSelect,
  onHover,
}: {
  node: ArchitectureNode;
  active: boolean;
  hover: boolean;
  onSelect: () => void;
  onHover: (hover: boolean) => void;
}) {
  const color = palette[node.status || ""] || (active ? "#b8a3ff" : "#788bba");
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
      scale={active ? 1.12 : hover ? 1.05 : 1}
    >
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[0.9, 0.09, 0.85]} />
        <meshStandardMaterial
          color="#161f38"
          metalness={0.65}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, -0.225, 0]}>
        <boxGeometry args={[0.92, 0.018, 0.87]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.75 : 0.14}
        />
      </mesh>
      {node.kind === "repository" ? (
        <>
          <mesh position={[0, 0.3, 0]} rotation={[0.25, 0.5, 0.1]}>
            <icosahedronGeometry args={[0.62, 0]} />
            <meshStandardMaterial
              color={color}
              metalness={0.55}
              roughness={0.24}
              emissive={color}
              emissiveIntensity={0.12}
              flatShading
            />
          </mesh>
          <mesh position={[0, 0.3, 0]} rotation={[0.25, 0.5, 0.1]}>
            <icosahedronGeometry args={[0.64, 0]} />
            <meshBasicMaterial
              color="#dacfff"
              wireframe
              transparent
              opacity={0.35}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
            <torusGeometry args={[0.85, 0.012, 6, 64]} />
            <meshBasicMaterial color="#af93ff" />
          </mesh>
        </>
      ) : node.kind === "database" ? (
        <>
          {[0, 0.16, 0.32].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[0.32, 0.32, 0.13, 24]} />
              <meshStandardMaterial
                color={color}
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
          ))}
        </>
      ) : node.kind === "function" || node.kind === "interface" ? (
        <mesh position={[0, 0.12, 0]}>
          <octahedronGeometry args={[0.38]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
        </mesh>
      ) : (
        <>
          {[0, 0.11, 0.22].map((y, index) => (
            <mesh
              key={y}
              position={[index * 0.035, y, 0]}
              rotation={[0, -0.1, 0]}
            >
              <boxGeometry args={[0.58, 0.085, 0.48]} />
              <meshStandardMaterial
                color={index === 2 ? color : "#354767"}
                metalness={0.45}
                roughness={0.32}
              />
            </mesh>
          ))}
          {[0, 1, 2].map((index) => (
            <mesh key={index} position={[-0.035, 0.267, -0.12 + index * 0.1]}>
              <boxGeometry args={[index === 2 ? 0.22 : 0.36, 0.012, 0.018]} />
              <meshBasicMaterial color="#e5eafa" transparent opacity={0.65} />
            </mesh>
          ))}
        </>
      )}
      {active && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.19, 0]}>
          <ringGeometry args={[0.65, 0.68, 48]} />
          <meshBasicMaterial color="#ac8dff" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
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
  const [hover, setHover] = useState(-1),
    [angle, setAngle] = useState(0.55),
    [distance, setDistance] = useState(9.5);
  const drag = useRef<{ x: number; angle: number; moved: boolean } | null>(
    null,
  );
  const points = useMemo(
    () =>
      positions(nodes).map(([x, y, z]): [number, number, number] => [
        x,
        z * 0.3 + 0.2,
        y,
      ]),
    [nodes],
  );
  return (
    <div
      className="scene-stage"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        drag.current = { x: event.clientX, angle, moved: false };
      }}
      onPointerMove={(event) => {
        if (!drag.current || !event.buttons) return;
        const delta = event.clientX - drag.current.x;
        if (Math.abs(delta) > 5) {
          drag.current.moved = true;
          setAngle(drag.current.angle - delta * 0.008);
        }
      }}
      onPointerUp={() => {
        setTimeout(() => {
          drag.current = null;
        }, 0);
      }}
      onPointerLeave={() => {
        drag.current = null;
      }}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [5, 7, 9], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        aria-label="Interactive 3D code architecture; drag to rotate or use the view controls"
      >
        <ambientLight intensity={1.1} />
        <directionalLight
          position={[3, 7, 5]}
          intensity={3.5}
          color="#ddd5ff"
        />
        <pointLight position={[-4, 2, 2]} intensity={25} color="#6b72ff" />
        <pointLight position={[3, 2, -4]} intensity={18} color="#77ddca" />
        <CameraRig
          target={points[selected] || [0, 0, 0]}
          angle={angle}
          distance={distance}
        />
        <gridHelper
          args={[12, 24, "#3b4168", "#1b2540"]}
          position={[0, -0.5, 0]}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.51, 0]}>
          <circleGeometry args={[6.5, 64]} />
          <meshStandardMaterial
            color="#10172a"
            metalness={0.25}
            roughness={0.65}
            transparent
            opacity={0.65}
          />
        </mesh>
        {[2.7, 4.5].map((radius) => (
          <mesh
            key={radius}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.47, 0]}
          >
            <ringGeometry args={[radius, radius + 0.009, 80]} />
            <meshBasicMaterial
              color="#596083"
              transparent
              opacity={0.32}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
        {edges.slice(0, 90).map((edge, index) => {
          const a = nodes.findIndex((node) => node.id === edge.source),
            b = nodes.findIndex((node) => node.id === edge.target);
          return a < 0 || b < 0 ? null : (
            <Wire
              key={`${edge.source}:${edge.target}:${index}`}
              a={points[a]}
              b={points[b]}
              color={edge.kind === "import" ? "#77dcc1" : "#a291eb"}
              active={a === selected || b === selected}
            />
          );
        })}
        {nodes.map((node, index) => (
          <group key={node.id} position={points[index]}>
            <Module
              node={node}
              active={selected === index}
              hover={hover === index}
              onSelect={() => {
                if (!drag.current?.moved) onSelect(index);
              }}
              onHover={(active) => setHover(active ? index : -1)}
            />
          </group>
        ))}
      </Canvas>
      <div className="scene-controls" aria-label="3D view controls">
        <span>
          <Move size={12} />
          Drag to orbit
        </span>
        <button
          aria-label="Rotate scene left"
          onClick={() => setAngle(angle - 0.4)}
        >
          <RotateCcw size={14} />
        </button>
        <button
          aria-label="Rotate scene right"
          onClick={() => setAngle(angle + 0.4)}
        >
          <RotateCw size={14} />
        </button>
        <button
          aria-label="Zoom out"
          disabled={distance >= 14}
          onClick={() => setDistance(Math.min(14, distance + 1))}
        >
          <Minus size={14} />
        </button>
        <button
          aria-label="Zoom in"
          disabled={distance <= 5}
          onClick={() => setDistance(Math.max(5, distance - 1))}
        >
          <Plus size={14} />
        </button>
        <button
          aria-label="Reset 3D view"
          onClick={() => {
            setAngle(0.55);
            setDistance(9.5);
          }}
        >
          <Maximize2 size={14} />
        </button>
      </div>
      {hover >= 0 && nodes[hover] && (
        <span className="module-hover">
          {nodes[hover].kind} / {nodes[hover].label}
        </span>
      )}
    </div>
  );
}
