import React from 'react';
import { Canvas } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { OrbitControls } from "@react-three/drei";
import { VhsGlitchEffect } from "./VhsGlitchEffect";

export function VhsGlitchScene() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: "#5c5c5c" }}
      >
        <color attach="background" args={["#5c5c5c"]} />

        {/* Lighting */}
        <hemisphereLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={2} />
        <directionalLight position={[-5, 3, -5]} intensity={1.2} />

        {/* 3D Model */}
        <mesh scale={0.5} rotation={[0, 0, 0]}>
          <torusKnotGeometry args={[0.8, 0.3, 100, 16]} />
          <meshStandardMaterial color="#917aff" roughness={0.3} metalness={0.1} />
        </mesh>

        <OrbitControls enableDamping enableZoom={true} />

        {/* VHS Glitch Effect */}
        <EffectComposer>
          <VhsGlitchEffect
            grain={0.4}
            glitchBlocks={0.5}
            rgbShift={0.85}
            scanlines={0.85}
            noise={0.3}
            distortion={0.85}
            speed={1}
            animated={true}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
