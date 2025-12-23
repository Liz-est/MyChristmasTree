import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants';

interface GoldDustProps {
  gesturePosRef?: React.MutableRefObject<{x: number, y: number}>;
  isGestureActive?: boolean;
}

const GoldDust: React.FC<GoldDustProps> = ({ gesturePosRef, isGestureActive }) => {
  const { pointer, camera } = useThree();
  const particleCount = 2000;
  const hasInteracted = useRef(false);

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < particleCount; i++) {
      const isGold = Math.random() > 0.8; 
      const size = isGold 
        ? Math.random() * 0.4 + 0.1
        : Math.random() * 0.8 + 0.4;

      temp.push({
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * 50,
          (Math.random() - 0.5) * 40, 
          (Math.random() - 0.5) * 40
        ),
        vel: new THREE.Vector3(0, 0, 0),
        basePos: new THREE.Vector3(
          (Math.random() - 0.5) * 50,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40
        ),
        size: size,
        phase: Math.random() * Math.PI * 2,
        isGold: isGold,
        color: isGold ? COLORS.GOLD_HIGH : COLORS.SNOW_WHITE,
      });
    }
    return temp;
  }, []);

  const positions = useMemo(() => new Float32Array(particleCount * 3), [particleCount]);
  const colors = useMemo(() => new Float32Array(particleCount * 3), [particleCount]);
  const sizes = useMemo(() => new Float32Array(particleCount), [particleCount]);

  useMemo(() => {
    particles.forEach((p, i) => {
      colors[i*3] = p.color.r;
      colors[i*3+1] = p.color.g;
      colors[i*3+2] = p.color.b;
    });
  }, [particles, colors]);
  
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const vec = useMemo(() => new THREE.Vector3(), []);
  const target3D = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    
    // Interaction Trigger
    if (!hasInteracted.current) {
        if (isGestureActive || pointer.x !== 0 || pointer.y !== 0) {
            hasInteracted.current = true;
        }
    }
    const currentlyInteracting = hasInteracted.current;

    // Calculate Target Position (Mouse vs Gesture)
    if (currentlyInteracting) {
      let inputX = pointer.x;
      let inputY = pointer.y;

      // Override with gesture if active
      if (isGestureActive && gesturePosRef) {
        inputX = gesturePosRef.current.x;
        inputY = gesturePosRef.current.y;
      }

      vec.set(inputX, inputY, 0.5);
      vec.unproject(camera);
      const direction = vec.sub(camera.position).normalize();
      const distanceToPlane = -camera.position.z / direction.z;
      
      if (distanceToPlane > 0 && distanceToPlane < 100) {
          target3D.copy(camera.position).add(direction.multiplyScalar(distanceToPlane));
      }
    }

    let activeInteractionCount = 0;
    const MAX_INTERACTION_COUNT = 224; 

    particles.forEach((p, i) => {
      if (p.isGold) {
        p.vel.y += 0.0001; 
        p.vel.x += Math.sin(time * 0.5 + p.phase) * 0.0003; 
      } else {
        // INCREASED GRAVITY 10% (0.00031 -> 0.00034)
        p.vel.y -= 0.00034; 
        p.vel.x += Math.sin(time * 0.3 + p.phase) * 0.0002; 
        p.vel.z += Math.cos(time * 0.2 + p.phase) * 0.0002; 
      }

      if (currentlyInteracting) {
        const dist = p.pos.distanceTo(target3D);
        const gatherRadius = 14.4;
        const hoverRadius = 1.5; 

        if (dist < gatherRadius && activeInteractionCount < MAX_INTERACTION_COUNT) {
          activeInteractionCount++; 

          if (dist > hoverRadius) {
            dir.copy(target3D).sub(p.pos).normalize();
            const gatherStrength = 0.015; 
            p.vel.addScaledVector(dir, gatherStrength);
          } else {
            p.vel.multiplyScalar(0.95); 
          }

          p.vel.x += (Math.random() - 0.5) * 0.004;
          p.vel.y += (Math.random() - 0.5) * 0.004;
          p.vel.z += (Math.random() - 0.5) * 0.004;
        }
      }

      p.vel.multiplyScalar(0.96); 
      
      const maxSpeed = 0.15;
      if (p.vel.lengthSq() > maxSpeed * maxSpeed) {
        p.vel.setLength(maxSpeed);
      }

      p.pos.add(p.vel);

      // Bounds Wrap
      if (p.pos.y < -20) p.pos.y = 20;
      if (p.pos.y > 20) p.pos.y = -20;
      if (p.pos.x < -25) p.pos.x = 25;
      if (p.pos.x > 25) p.pos.x = -25;
      if (p.pos.z < -20) p.pos.z = 20;
      if (p.pos.z > 20) p.pos.z = -20;

      positions[i * 3] = p.pos.x;
      positions[i * 3 + 1] = p.pos.y;
      positions[i * 3 + 2] = p.pos.z;
      
      sizes[i] = p.size * (1 + Math.sin(time * (p.isGold ? 4 : 1.5) + p.phase) * 0.3);
    });

    if (geometryRef.current) {
      geometryRef.current.attributes.position.needsUpdate = true;
      geometryRef.current.attributes.aSize.needsUpdate = true;
    }
  });

  return (
    <points>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={sizes.length}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          attribute float aSize;
          attribute vec3 color;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (200.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          void main() {
            vec2 center = gl_PointCoord - 0.5;
            float dist = length(center);
            if (dist > 0.5) discard;
            float alpha = 1.0 - smoothstep(0.1, 0.5, dist);
            gl_FragColor = vec4(vColor, alpha * 1.2);
          }
        `}
      />
    </points>
  );
};

export default GoldDust;