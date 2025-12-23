
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS } from '../constants';
import { TreeState } from '../types';

interface PhotoFrameProps {
  targetPosition: THREE.Vector3;
  targetRotation: THREE.Euler;
  imageUrl?: string;
  rotation?: number; // degrees
  treeState: TreeState;
  index: number;
  visible: boolean; // Control visibility
  onFrameClick: (index: number, hasImage: boolean) => void;
  onFrameDoubleClick: (index: number, hasImage: boolean) => void;
}

const PhotoFrame: React.FC<PhotoFrameProps> = ({ 
  targetPosition, 
  targetRotation, 
  imageUrl, 
  rotation = 0,
  treeState, 
  index,
  visible,
  onFrameClick,
  onFrameDoubleClick
}) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useCursor(hovered);

  // Load Texture
  useEffect(() => {
    if (imageUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(imageUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setTexture(tex);
      });
    } else {
      setTexture(null);
    }
  }, [imageUrl]);

  // Apply Rotation to Texture
  useEffect(() => {
    if (texture) {
      texture.center.set(0.5, 0.5);
      // CSS rotate() is clockwise, ThreeJS is CCW.
      // We negate the angle to sync the visual rotation direction.
      // Added + Math.PI (180 degrees) to fix the upside-down mapping mismatch.
      texture.rotation = -(rotation * Math.PI) / 180 + Math.PI;
    }
  }, [texture, rotation]);

  // Chaos Physics Data (Floating in zero-G)
  const chaosData = useMemo(() => {
    return {
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      ),
      rotSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      )
    };
  }, []);

  // Animation Loop
  useFrame((state, delta) => {
    if (!visible || !groupRef.current) return;

    // Hover Effect Scale
    const targetScale = hovered ? 1.15 : 1.0;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10);

    if (treeState === TreeState.CHAOS) {
      // Float towards random chaos position
      const hoverY = Math.sin(state.clock.elapsedTime + index) * 0.5;
      const target = chaosData.pos.clone();
      target.y += hoverY;

      // Soft lerp to chaos pos
      groupRef.current.position.lerp(target, delta * 0.5);
      
      // Rotate slowly in chaos
      groupRef.current.rotation.x += chaosData.rotSpeed.x * delta;
      groupRef.current.rotation.y += chaosData.rotSpeed.y * delta;
      groupRef.current.rotation.z += chaosData.rotSpeed.z * delta;

    } else {
      // Fly to Ribbon Position (Attached)
      groupRef.current.position.lerp(targetPosition, delta * 2.0);
      
      const currentQ = groupRef.current.quaternion;
      const targetQ = new THREE.Quaternion().setFromEuler(targetRotation);
      currentQ.slerp(targetQ, delta * 2.0);
    }
  });

  if (!visible) return null;

  return (
    <group 
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        if (!imageUrl) {
            onFrameClick(index, false);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (imageUrl) {
            onFrameDoubleClick(index, true);
        }
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Frame Border (Gold Box) */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[1.4, 1.4, 0.1]} />
        <meshStandardMaterial 
          color={hovered ? '#ffedb3' : COLORS.GOLD_HIGH} 
          metalness={1.0} 
          roughness={0.15} 
          emissive={COLORS.GOLD_DARK}
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Frame Backing (Dark Grey) */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[1.35, 1.35, 0.05]} />
        <meshStandardMaterial color="#111111" />
      </mesh>

      {/* Photo Area */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.2, 1.2]} />
        {texture ? (
          <meshBasicMaterial 
            map={texture} 
            side={THREE.DoubleSide}
            color="white"
            toneMapped={false}
          />
        ) : (
          <meshStandardMaterial 
            color="#222222" 
            roughness={0.8}
          />
        )}
      </mesh>
    </group>
  );
};

export default PhotoFrame;
