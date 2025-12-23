import React, { useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Group } from 'three';

interface SpinWrapperProps {
  children: React.ReactNode;
  onOrbit?: (deltaY: number) => void;
  gestureVelocityRef?: React.MutableRefObject<number>;
  isWallpaperMode?: boolean; // [新增] 接收壁纸模式状态
}

const SpinWrapper: React.FC<SpinWrapperProps> = ({ 
  children, 
  onOrbit, 
  gestureVelocityRef,
  isWallpaperMode = false 
}) => {
  const groupRef = useRef<Group>(null);
  const velocity = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const isDragging = useRef(false);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (isWallpaperMode) return; // [新增] 壁纸模式禁止交互
    e.stopPropagation(); 
    isDragging.current = true;
    lastX.current = e.clientX;
    lastY.current = e.clientY;
    // @ts-ignore
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isWallpaperMode) return; // [新增]
    if (isDragging.current) {
      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      velocity.current += deltaX * 0.0008;
      if (onOrbit) onOrbit(deltaY);
      lastX.current = e.clientX;
      lastY.current = e.clientY;
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (isWallpaperMode) return; // [新增]
    isDragging.current = false;
    // @ts-ignore
    e.target.releasePointerCapture(e.pointerId);
  };

  useFrame((state, delta) => {
    if (groupRef.current) {
      if (isWallpaperMode) {
        // [新增] 壁纸模式：匀速自动旋转 (速度 0.5)
        groupRef.current.rotation.y -= delta * 0.5;
        velocity.current = 0; // 清除惯性
      } else {
        // 正常模式：物理惯性
        if (gestureVelocityRef && gestureVelocityRef.current !== 0) {
          velocity.current += gestureVelocityRef.current;
          gestureVelocityRef.current = 0; 
        }
        groupRef.current.rotation.y += velocity.current;
        velocity.current *= 0.92; 
        if (Math.abs(velocity.current) < 0.0001) velocity.current = 0;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {children}
    </group>
  );
};

export default SpinWrapper;