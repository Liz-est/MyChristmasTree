import React, { useRef, useState } from 'react';
import { PerspectiveCamera, Environment } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { TreeState } from '../types';
import Foliage from './Foliage';
import Ornaments from './Ornaments';
import GoldDust from './GoldDust';
import SpinWrapper from './SpinWrapper';
import TopStar from './TopStar';
import RibbonSystem from './RibbonSystem';
import { CONFIG, COLORS } from '../constants';
import SantaHat from './SantaHat';

interface SceneProps {
  treeState: TreeState;
  camDistance: number;
  camPolarAngle: number;
  ribbonVisible: boolean;
  ribbonImages: {[key: number]: string};
  imageRotations: {[key: number]: number};
  onFrameClick: (index: number, hasImage: boolean) => void;
  onFrameDoubleClick: (index: number, hasImage: boolean) => void;
  onOrbit: (deltaY: number) => void;
  gestureVelocityRef: React.MutableRefObject<number>;
  gesturePosRef: React.MutableRefObject<{x: number, y: number}>;
  isGestureActive: boolean;
  isWallpaperMode?: boolean; // [新增]
}

const Scene: React.FC<SceneProps> = ({ 
  treeState, 
  camDistance, 
  camPolarAngle,
  ribbonVisible, 
  ribbonImages, 
  imageRotations, 
  onFrameClick, 
  onFrameDoubleClick,
  onOrbit,
  gestureVelocityRef,
  gesturePosRef,
  isGestureActive,
  isWallpaperMode = false // [新增]
}) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  
  const [isHatFocused, setIsHatFocused] = useState(false);
  const [isHatHovered, setIsHatHovered] = useState(false);
  const hatAnchorRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (cameraRef.current) {
      const centerY = 5.0;
      const y = centerY + camDistance * Math.cos(camPolarAngle);
      const z = camDistance * Math.sin(camPolarAngle);
      const targetPos = new THREE.Vector3(0, y, z);
      cameraRef.current.position.lerp(targetPos, delta * 3.0);
      cameraRef.current.lookAt(0, centerY, 0);
    }
  });

  const handleBackgroundClick = (e: any) => {
    e.stopPropagation();
    setIsHatFocused(false);
  };

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 10, 24]} fov={45} />
      
      <ambientLight intensity={0.4} color={COLORS.EMERALD_DEEP} />
      <pointLight position={[10, 15, 10]} intensity={2.5} color={COLORS.GOLD_HIGH} distance={50} decay={2} />
      <pointLight position={[-10, 8, 10]} intensity={2} color="#ffaa33" distance={50} decay={2} />
      <spotLight position={[0, 25, -10]} angle={0.5} penumbra={1} intensity={4} color="#ffffff" castShadow />

      <Environment preset="city" background={false} />

      {/* 遮罩层：壁纸模式下不显示 */}
      {isHatFocused && !isWallpaperMode && (
        <mesh 
            position={[0, 5, 0]} 
            renderOrder={10} 
            onPointerDown={handleBackgroundClick}
        >
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial 
            color="black" 
            transparent 
            opacity={0.8} 
            depthTest={false} 
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 树主体 */}
      <group 
        position={[0, 4.5, 0]}
        // 聚焦、悬停或壁纸模式下，禁用树的交互
        raycast={(isHatFocused || isHatHovered || isWallpaperMode) ? null : undefined}
      >
        <SpinWrapper 
            onOrbit={isHatFocused ? () => {} : onOrbit} 
            gestureVelocityRef={gestureVelocityRef}
            isWallpaperMode={isWallpaperMode} // [传参]
        >
          <Foliage treeState={treeState} />
          <Ornaments treeState={treeState} />
          <TopStar />
          <RibbonSystem 
            visible={ribbonVisible} 
            images={ribbonImages}
            imageRotations={imageRotations} 
            treeState={treeState}
            onFrameClick={onFrameClick}
            onFrameDoubleClick={onFrameDoubleClick}
          />
          {/* 锚点 */}
          <group ref={hatAnchorRef} position={[2.5, 6.0, 6.0]} />
        </SpinWrapper>
      </group>
      
      {/* 
         圣诞帽
         [关键修改] 壁纸模式下 (!isWallpaperMode) 才渲染帽子
      */}
      {!isWallpaperMode && (
        <SantaHat 
            anchorRef={hatAnchorRef}
            focused={isHatFocused}           
            onOpen={() => setIsHatFocused(true)} 
            onClose={() => setIsHatFocused(false)}
            onHoverChange={(hovering: boolean) => setIsHatHovered(hovering)}
            renderOrder={9999}
            initialPos={[2.5, 10.5, 6.0]} 
        />
      )}

      {/* 金粉 */}
      <group raycast={null}>
        <GoldDust gesturePosRef={gesturePosRef} isGestureActive={isGestureActive} />
      </group>

      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={CONFIG.bloomThreshold} intensity={CONFIG.bloomIntensity} levels={9} mipmapBlur radius={0.7} />
        <Vignette eskil={false} offset={0.1} darkness={0.65} />
      </EffectComposer>
    </>
  );
};

export default Scene;