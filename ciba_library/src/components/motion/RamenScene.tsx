"use client";

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float } from "@react-three/drei";
import { DoubleSide, type Group, type Mesh } from "three";

/**
 * The WebGL centerpiece — a detailed stylized bowl of ramen: a ceramic bowl
 * with a terracotta rim and foot, an amber broth surface holding a noodle nest,
 * a soft-boiled ajitama egg, a chashu slice, narutomaki, a nori sheet, and
 * scallion confetti, with chopsticks across the rim and steam rising off the
 * top. It slowly turns and eases toward the pointer. This is the site's single
 * true-3D moment; every other depth effect is anime.js CSS 3D.
 *
 * Rendered only on the client behind a dynamic() boundary (see HeroRamen), so
 * three.js never touches SSR or the rest of the bundle.
 */
const CERAMIC = "#f2ede4";
const CERAMIC_IN = "#e9e2d5";
const RIM = "#e0602c";
const BROTH = "#c8842e";
const BROTH_DEEP = "#a9691f";
const NOODLE = "#ecd88f";
const EGG = "#fbf3e0";
const YOLK = "#e8a13c";
const CHASHU = "#c07a44";
const CHASHU_RIM = "#8f5227";
const NARUTO = "#f6eee6";
const NARUTO_PINK = "#e07a8a";
const NORI = "#20302a";
const SCALLION = "#6f9e4b";
const WOOD = "#b98a5e";

/** Green-onion bits scattered on the broth: [x, z] on the surface plane. */
const SCALLIONS: Array<[number, number]> = [
  [0.28, 0.34],
  [-0.12, 0.52],
  [0.62, -0.14],
  [-0.42, -0.32],
  [0.14, -0.46],
  [-0.55, 0.18],
  [0.4, 0.08],
];

/** Rising steam wisps — subtle vertical translucent spheres, looped. */
function Steam() {
  const wisps = React.useRef<Array<Mesh | null>>([]);

  useFrame((_, delta) => {
    wisps.current.forEach((m, i) => {
      if (!m) return;
      m.position.y += delta * (0.35 + i * 0.05);
      const span = 1.6;
      const base = 0.4;
      if (m.position.y > base + span) m.position.y = base;
      // Fade out as it rises.
      const t = (m.position.y - base) / span;
      const mat = m.material as { opacity: number };
      mat.opacity = 0.16 * (1 - t);
    });
  });

  return (
    <>
      {[-0.35, 0.05, 0.4].map((x, i) => (
        <mesh
          key={i}
          ref={(el) => {
            wisps.current[i] = el;
          }}
          position={[x, 0.4 + i * 0.35, 0.05 + (i - 1) * 0.15]}
          scale={[0.16, 0.5, 0.16]}
        >
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

function Ramen({ reduced }: { reduced: boolean }) {
  const group = React.useRef<Group>(null);

  useFrame((state, delta) => {
    if (!group.current || reduced) return;
    group.current.rotation.y += delta * 0.32;
    // Hold a slight forward tilt so we see into the bowl; lean with the pointer.
    const targetX = 0.36 + state.pointer.y * 0.12;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.05;
  });

  return (
    <group ref={group} rotation={[0.36, 0, 0]}>
      {/* Bowl body — lower hemisphere, open top */}
      <mesh castShadow receiveShadow>
        <sphereGeometry
          args={[1.3, 64, 64, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]}
        />
        <meshStandardMaterial
          color={CERAMIC}
          side={DoubleSide}
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>

      {/* Inner wall tint just below the rim */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[1.24, 1.05, 0.5, 64, 1, true]} />
        <meshStandardMaterial
          color={CERAMIC_IN}
          side={DoubleSide}
          roughness={0.7}
        />
      </mesh>

      {/* Terracotta rim */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.07, 20, 64]} />
        <meshStandardMaterial color={RIM} roughness={0.4} />
      </mesh>

      {/* Decorative inner ring line */}
      <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.12, 0.02, 12, 64]} />
        <meshStandardMaterial color={RIM} roughness={0.5} />
      </mesh>

      {/* Foot / base ring */}
      <mesh position={[0, -1.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.08, 16, 48]} />
        <meshStandardMaterial color={CERAMIC_IN} roughness={0.7} />
      </mesh>

      {/* Broth surface */}
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.18, 64]} />
        <meshStandardMaterial color={BROTH} roughness={0.25} metalness={0.15} />
      </mesh>

      {/* Noodle nest peeking above the broth */}
      <mesh position={[-0.15, -0.04, -0.25]} rotation={[0.3, 0.4, 0]} castShadow>
        <torusKnotGeometry args={[0.34, 0.11, 160, 14, 2, 3]} />
        <meshStandardMaterial color={NOODLE} roughness={0.55} />
      </mesh>
      <mesh position={[0.28, -0.05, -0.05]} rotation={[0.5, 1.1, 0.2]} castShadow>
        <torusKnotGeometry args={[0.22, 0.08, 120, 12, 3, 2]} />
        <meshStandardMaterial color={NOODLE} roughness={0.55} />
      </mesh>

      {/* Chashu (pork) slice */}
      <mesh
        position={[-0.5, -0.05, 0.28]}
        rotation={[-Math.PI / 2, 0, 0.3]}
        castShadow
      >
        <cylinderGeometry args={[0.32, 0.32, 0.05, 40]} />
        <meshStandardMaterial color={CHASHU} roughness={0.6} />
      </mesh>
      <mesh position={[-0.5, -0.02, 0.28]} rotation={[Math.PI / 2, 0, 0.3]}>
        <torusGeometry args={[0.32, 0.02, 12, 40]} />
        <meshStandardMaterial color={CHASHU_RIM} roughness={0.6} />
      </mesh>

      {/* Soft-boiled ajitama egg (half) */}
      <mesh position={[0.52, -0.02, 0.32]} scale={[0.34, 0.26, 0.34]} castShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={EGG} roughness={0.5} />
      </mesh>
      <mesh position={[0.52, 0.11, 0.32]} scale={0.14}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={YOLK}
          roughness={0.35}
          emissive={YOLK}
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* Narutomaki (fish cake) with a pink swirl */}
      <mesh position={[0.12, -0.03, 0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.06, 32]} />
        <meshStandardMaterial color={NARUTO} roughness={0.55} />
      </mesh>
      <mesh position={[0.12, 0.02, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.08, 0.02, 10, 24]} />
        <meshStandardMaterial color={NARUTO_PINK} roughness={0.5} />
      </mesh>
      <mesh position={[0.12, 0.02, 0.5]} scale={0.04}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color={NARUTO_PINK} roughness={0.5} />
      </mesh>

      {/* Nori sheet standing at the back edge */}
      <mesh position={[-0.5, 0.2, -0.5]} rotation={[0.15, 0.6, 0.05]} castShadow>
        <boxGeometry args={[0.52, 0.6, 0.015]} />
        <meshStandardMaterial color={NORI} roughness={0.8} side={DoubleSide} />
      </mesh>

      {/* Scallion confetti */}
      {SCALLIONS.map(([x, z], i) => (
        <mesh
          key={i}
          position={[x, -0.05, z]}
          rotation={[Math.PI / 2, 0, i]}
          castShadow
        >
          <torusGeometry args={[0.05, 0.02, 8, 16]} />
          <meshStandardMaterial color={SCALLION} roughness={0.6} />
        </mesh>
      ))}

      {/* Chopsticks resting across the rim */}
      <group position={[-0.3, 0.3, 0.4]} rotation={[0, 0.5, 0.08]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.035, 0.028, 2.9, 12]} />
          <meshStandardMaterial color={WOOD} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.16, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.035, 0.028, 2.9, 12]} />
          <meshStandardMaterial color={WOOD} roughness={0.7} />
        </mesh>
      </group>

      {/* Broth "depth" ring under the surface to hint volume */}
      <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 48]} />
        <meshStandardMaterial color={BROTH_DEEP} roughness={0.4} />
      </mesh>

      {!reduced && <Steam />}
    </group>
  );
}

export default function RamenScene({ reduced = false }: { reduced?: boolean }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.5, 3.8], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={2.2}
        color="#ffd9b0"
        castShadow
      />
      <directionalLight position={[-3, 1, -2]} intensity={0.5} color="#9fb4ff" />

      <Float
        speed={reduced ? 0 : 1.2}
        rotationIntensity={0}
        floatIntensity={reduced ? 0 : 0.6}
      >
        <Ramen reduced={reduced} />
      </Float>

      <ContactShadows
        position={[0, -1.35, 0]}
        opacity={0.35}
        scale={7}
        blur={2.6}
        far={3}
      />
    </Canvas>
  );
}
