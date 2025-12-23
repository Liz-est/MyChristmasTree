import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG, COLORS } from '../constants';
import { TreeState, OrnamentData } from '../types';

interface OrnamentsProps {
  treeState: TreeState;
}

const Ornaments: React.FC<OrnamentsProps> = ({ treeState }) => {
  const sphereRef = useRef<THREE.InstancedMesh>(null);
  const boxRef = useRef<THREE.InstancedMesh>(null);

  // Initialize Data
  const { allData, sphereIndices, boxIndices } = useMemo(() => {
    const temp: OrnamentData[] = [];
    const sphereIdx: number[] = [];
    const boxIdx: number[] = [];
    
    // Balanced Palette for Lights
    const colorPalette = [
      COLORS.RED_VELVET, 
      COLORS.RED_VELVET, 
      COLORS.GOLD_HIGH, 
      COLORS.GOLD_HIGH,
    ];
    
    for (let i = 0; i < CONFIG.ornamentCount; i++) {
      // Chaos Pos
      const r = 35 * Math.cbrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const chaosPos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );

      // Target Pos (On surface of cone)
      // Height from 0 to CONFIG.treeHeight
      const h = Math.random() * (CONFIG.treeHeight - 1);
      const heightPercent = h / CONFIG.treeHeight;
      
      const maxR = (CONFIG.treeRadius - 0.5) * (1 - heightPercent);
      const angle = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(
        maxR * Math.cos(angle),
        h - (CONFIG.treeHeight / 2),
        maxR * Math.sin(angle)
      );

      // Type & Physics Weight
      const typeRoll = Math.random();
      let type: 'gift' | 'ball' | 'light' = 'ball';
      let speed = 2.0;
      let scale = 0.4;
      
      if (typeRoll > 0.6) { // 40% Chance of Gift Box
        type = 'gift'; // Box
        speed = 0.8; // Heavy
        scale = 0.6; // Increased base scale
      } else if (typeRoll < 0.2) { // 20% Chance of Tiny Light
        type = 'light'; // Small sphere
        speed = 3.5; // Very light
        scale = 0.15;
      } else { // 40% Chance of Standard Ball
        type = 'ball';
        speed = 2.0;
        scale = 0.45;
      }

      // Sphere Reduction Logic (Bottom heavy, sparse top)
      if (type === 'ball' || type === 'light') {
         // Higher up = higher chance to cull. 
         // Added base 0.1 (10%) + gradient to reduce count further
         if (Math.random() < 0.1 + (heightPercent * 0.4)) {
           continue; // Skip adding this ornament
         }
      }

      // Scale Randomization for Boxes (Max 30% volume diff ~ 9% scale diff)
      if (type === 'gift') {
         const variance = 0.045; 
         scale = scale * (1.0 + (Math.random() * variance * 2 - variance));
      }

      // Color Logic
      let color;
      if (type === 'gift') {
        // Enforce strict 1:1 Red/Gold for Boxes
        color = Math.random() > 0.5 ? COLORS.RED_VELVET : COLORS.GOLD_HIGH;
      } else if (type === 'ball') {
        // Silver Logic:
        // Generally 20% chance.
        // Prevent clumping at top by reducing probability significantly above 70% height
        const silverChance = heightPercent > 0.7 ? 0.05 : 0.22;
        
        if (Math.random() < silverChance) {
          color = COLORS.SILVER;
        } else {
          color = Math.random() > 0.5 ? COLORS.RED_VELVET : COLORS.GOLD_HIGH;
        }
      } else {
        // Lights use standard palette
        color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      }

      const item: OrnamentData = {
        id: i,
        chaosPos,
        targetPos,
        color: color,
        type,
        speed,
        scale,
        rotationOffset: new THREE.Vector3(Math.random()*Math.PI, Math.random()*Math.PI, 0)
      };

      temp.push(item);

      if (type === 'gift') {
        boxIdx.push(temp.length - 1);
      } else {
        sphereIdx.push(temp.length - 1);
      }
    }
    return { allData: temp, sphereIndices: sphereIdx, boxIndices: boxIdx };
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize Colors
  useLayoutEffect(() => {
    // Set colors for spheres
    if (sphereRef.current) {
      sphereIndices.forEach((dataIndex, instanceIndex) => {
        sphereRef.current!.setColorAt(instanceIndex, allData[dataIndex].color);
      });
      sphereRef.current.instanceColor!.needsUpdate = true;
    }
    // Set colors for boxes
    if (boxRef.current) {
      boxIndices.forEach((dataIndex, instanceIndex) => {
        boxRef.current!.setColorAt(instanceIndex, allData[dataIndex].color);
      });
      boxRef.current.instanceColor!.needsUpdate = true;
    }
  }, [allData, sphereIndices, boxIndices]);

  // Track current positions
  const currentPositions = useRef<THREE.Vector3[]>(
    allData.map(d => d.chaosPos.clone())
  );

  useFrame((state, delta) => {
    const isFormed = treeState === TreeState.FORMED;

    // Update Spheres
    if (sphereRef.current) {
      sphereIndices.forEach((dataIndex, instanceIndex) => {
        const d = allData[dataIndex];
        const currentPos = currentPositions.current[dataIndex];
        const target = isFormed ? d.targetPos : d.chaosPos;
        
        const step = delta * d.speed * (isFormed ? 1.0 : 0.5);
        currentPos.lerp(target, step);

        dummy.position.copy(currentPos);
        dummy.rotation.set(0, 0, 0); 
        dummy.scale.setScalar(d.scale);

        if (d.type === 'light') {
           const pulse = 1 + Math.sin(state.clock.elapsedTime * 5 + d.id) * 0.3;
           dummy.scale.multiplyScalar(pulse);
        }

        dummy.updateMatrix();
        sphereRef.current!.setMatrixAt(instanceIndex, dummy.matrix);
      });
      sphereRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update Boxes
    if (boxRef.current) {
      boxIndices.forEach((dataIndex, instanceIndex) => {
        const d = allData[dataIndex];
        const currentPos = currentPositions.current[dataIndex];
        const target = isFormed ? d.targetPos : d.chaosPos;
        
        const step = delta * d.speed * (isFormed ? 1.0 : 0.5);
        currentPos.lerp(target, step);

        dummy.position.copy(currentPos);
        // Rotate gifts
        dummy.rotation.set(
            d.rotationOffset.x + state.clock.elapsedTime * 0.5,
            d.rotationOffset.y + state.clock.elapsedTime * 0.3,
            d.rotationOffset.z
        );
        dummy.scale.setScalar(d.scale);

        dummy.updateMatrix();
        boxRef.current!.setMatrixAt(instanceIndex, dummy.matrix);
      });
      boxRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* SPHERES (Balls + Lights) */}
      <instancedMesh
        ref={sphereRef}
        args={[undefined, undefined, sphereIndices.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          metalness={1.0}
          roughness={0.15}
          emissive={COLORS.GOLD_DARK}
          emissiveIntensity={0.1}
        />
      </instancedMesh>

      {/* BOXES (Gifts) */}
      <instancedMesh
        ref={boxRef}
        args={[undefined, undefined, boxIndices.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          metalness={0.9}
          roughness={0.1}
        />
      </instancedMesh>
    </group>
  );
};

export default Ornaments;