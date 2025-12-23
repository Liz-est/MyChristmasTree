
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CONFIG } from '../constants';
import PhotoFrame from './PhotoFrame';
import { TreeState } from '../types';
import './shaders'; // Import shaders

// Custom Curve for the Spiral
class TreeSpiralCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    public height: number = 15, 
    public baseRadius: number = 6.5, 
    public turns: number = 4.5
  ) {
    super();
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    // t goes from 0 (bottom) to 1 (top)
    const y = (t - 0.5) * this.height;
    // Radius shrinks as we go up
    const r = this.baseRadius * (1 - t) + 0.5; 
    const angle = t * Math.PI * 2 * this.turns;

    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    return optionalTarget.set(x, y, z);
  }
}

interface RibbonSystemProps {
  visible: boolean;
  images: {[key: number]: string}; // Keyed by frame index
  imageRotations: {[key: number]: number}; // Keyed by frame index
  treeState: TreeState;
  onFrameClick: (index: number, hasImage: boolean) => void;
  onFrameDoubleClick: (index: number, hasImage: boolean) => void;
}

const RibbonSystem: React.FC<RibbonSystemProps> = ({ visible, images, imageRotations, treeState, onFrameClick, onFrameDoubleClick }) => {
  const curve = useMemo(() => new TreeSpiralCurve(CONFIG.treeHeight, CONFIG.treeRadius + 0.2, 4), []);
  const materialRef = useRef<any>(null);
  
  // 1. Generate Ribbon Geometry (Flat Triangle Strip)
  const ribbonGeometry = useMemo(() => {
    const segments = 300; // Resolution
    const width = 0.7; // Ribbon width
    
    const positions = [];
    const indices = [];
    const normals = [];
    const uvs = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t).normalize();
      
      // Calculate "Normal" relative to Tree Center (0, y, 0)
      const center = new THREE.Vector3(0, point.y, 0);
      const normalOut = new THREE.Vector3().subVectors(point, center).normalize();
      
      // Calculate Binormal (Width direction) to ensure ribbon lies flat against cone
      const binormal = new THREE.Vector3().crossVectors(tangent, normalOut).normalize();

      // Left and Right vertices along the width
      const left = point.clone().add(binormal.clone().multiplyScalar(width * 0.5));
      const right = point.clone().add(binormal.clone().multiplyScalar(-width * 0.5));

      positions.push(left.x, left.y, left.z);
      positions.push(right.x, right.y, right.z);

      normals.push(normalOut.x, normalOut.y, normalOut.z);
      normals.push(normalOut.x, normalOut.y, normalOut.z);

      // Map V from 0 (bottom) to 1 (top) for reveal animation
      uvs.push(0, t); 
      uvs.push(1, t);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }, [curve]);

  // 2. Generate Frame Positions
  const frameData = useMemo(() => {
    const frames = [];
    // Increased count to 10 to ensure ample coverage including bottom loops
    const count = 10; 
    
    for (let i = 0; i < count; i++) {
      // Distribute frames along the curve
      // Starting from 0.02 ensures the very first loop (bottom) gets a frame
      const t = 0.02 + (i / count) * 0.95; 
      
      const pos = curve.getPoint(t);
      
      // Calculate Vectors to determine orientation
      const center = new THREE.Vector3(0, pos.y, 0);
      const normalOut = new THREE.Vector3().subVectors(pos, center).normalize();
      const tangent = curve.getTangent(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, normalOut).normalize();

      // Push frame slightly out so it floats ON TOP of the ribbon
      pos.add(normalOut.clone().multiplyScalar(0.55)); 

      // Robust Matrix Construction to ensure Upright Orientation
      // X: Tangent
      // Y: Binormal (Up along cone surface)
      // Z: Normal (Outward)
      const mat = new THREE.Matrix4();
      mat.makeBasis(tangent, binormal, normalOut);
      const rot = new THREE.Euler().setFromRotationMatrix(mat);

      frames.push({
        pos,
        rot
      });
    }
    return frames;
  }, [curve]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      // Reveal Animation
      // If visible (FORMED), animate uReveal towards 1
      // If hidden (CHAOS), animate uReveal towards 0
      const target = (treeState === TreeState.FORMED && visible) ? 1.0 : 0.0;
      
      // Acceleration Logic:
      // If hiding (target 0), move faster (2.75 multiplier, +10% from 2.5).
      // If revealing (target 1), move slower/gracefully (0.5 multiplier).
      const speed = target === 0.0 ? delta * 2.75 : delta * 0.5;

      materialRef.current.uReveal = THREE.MathUtils.lerp(
        materialRef.current.uReveal,
        target,
        speed
      );
    }
  });

  return (
    <group>
      {/* Ribbon Mesh: "Fuzzy White Texture" via Custom Shader */}
      <mesh geometry={ribbonGeometry}>
        {/* @ts-ignore */}
        <fuzzyRibbonMaterial 
          ref={materialRef} 
          side={THREE.DoubleSide} 
          transparent 
        />
      </mesh>

      {/* Frames: Always mounted, handle their own physics */}
      {frameData.map((data, i) => (
        <PhotoFrame 
          key={i}
          index={i}
          targetPosition={data.pos}
          targetRotation={data.rot}
          imageUrl={images[i]} // Pass specific image for this index
          rotation={imageRotations[i] || 0} // Pass specific rotation
          treeState={treeState}
          visible={visible} // Pass visibility down
          onFrameClick={onFrameClick}
          onFrameDoubleClick={onFrameDoubleClick}
        />
      ))}
    </group>
  );
};

export default RibbonSystem;
