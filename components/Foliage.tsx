import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../constants';
import { TreeState } from '../types';
import './shaders'; // Ensure shaders are registered

interface FoliageProps {
  treeState: TreeState;
}

const Foliage: React.FC<FoliageProps> = ({ treeState }) => {
  const materialRef = useRef<any>(null);
  
  // Initialize Geometry Data
  const { positions, targets, scales } = useMemo(() => {
    const count = CONFIG.foliageCount;
    const positions = new Float32Array(count * 3); // Chaos positions
    const targets = new Float32Array(count * 3);   // Tree positions
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // 1. Chaos Position: Random Sphere
      const r = 40 * Math.cbrt(Math.random()); // Even distribution in sphere
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      // 2. Target Position: Cone
      // Height from 0 to CONFIG.treeHeight
      // Density logic: more particles at bottom? No, even distribution looks better.
      const h = Math.random() * CONFIG.treeHeight;
      // Radius at this height. Linearly decreases.
      const maxR = CONFIG.treeRadius * (1 - h / CONFIG.treeHeight);
      // Random placement within the radius (volume) or on surface?
      // Surface looks more defined, volume looks fuller. Let's do biased towards surface.
      const radiusAtHeight = maxR * Math.sqrt(Math.random()); 
      const angle = Math.random() * Math.PI * 2;

      targets[i3] = radiusAtHeight * Math.cos(angle);
      targets[i3 + 1] = h - (CONFIG.treeHeight / 2); // Center Y
      targets[i3 + 2] = radiusAtHeight * Math.sin(angle);

      // 3. Scale
      scales[i] = Math.random();
    }

    return { positions, targets, scales };
  }, []);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.elapsedTime;
      
      // Animate progress uniform
      const targetProgress = treeState === TreeState.FORMED ? 1 : 0;
      // Smooth lerp for the uniform
      materialRef.current.uProgress = THREE.MathUtils.lerp(
        materialRef.current.uProgress,
        targetProgress,
        delta * 0.8 // Speed of transition
      );
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aTargetPos"
          count={targets.length / 3}
          array={targets}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandomScale"
          count={scales.length}
          array={scales}
          itemSize={1}
        />
      </bufferGeometry>
      {/* @ts-ignore */}
      <foliageMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default Foliage;
