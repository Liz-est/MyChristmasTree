import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG, COLORS } from '../constants';

const TopStar: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 1.2;
    const innerRadius = 0.5;

    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const extrudeSettings = {
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelSegments: 2
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating
      meshRef.current.position.y = (CONFIG.treeHeight / 2) + 0.5 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
      // Gentle rotation
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      position={[0, CONFIG.treeHeight / 2, 0]}
      castShadow
    >
      <meshStandardMaterial 
        color={COLORS.GOLD_HIGH}
        emissive={COLORS.GOLD_HIGH}
        emissiveIntensity={0.8}
        metalness={1}
        roughness={0.1}
      />
      <pointLight distance={10} intensity={2} color={COLORS.GOLD_HIGH} />
    </mesh>
  );
};

export default TopStar;