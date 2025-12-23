import { Vector3, Color } from 'three';

export enum TreeState {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED'
}

export interface OrnamentData {
  id: number;
  chaosPos: Vector3;
  targetPos: Vector3;
  color: Color;
  type: 'gift' | 'ball' | 'light';
  speed: number; // For physics weight simulation
  scale: number;
  rotationOffset: Vector3;
}

export interface Uniforms {
  [key: string]: { value: any };
}
