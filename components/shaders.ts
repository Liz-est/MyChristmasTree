
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { COLORS } from '../constants';

// --------------------------------------------------------
// Foliage Shader: Morphs between chaos and tree form
// --------------------------------------------------------
export const FoliageMaterial = shaderMaterial(
  {
    uTime: 0,
    uProgress: 0, // 0 = Chaos, 1 = Formed
    uColorBase: COLORS.EMERALD_DEEP, // Deep Emerald
    uColorTip: COLORS.EMERALD_LIGHT, // Lighter Emerald Tip
    uGold: COLORS.GOLD_HIGH,         // Gold Sparkle
  },
  // Vertex Shader
  `
    uniform float uTime;
    uniform float uProgress;
    attribute vec3 aTargetPos;
    attribute float aRandomScale;
    
    varying float vHeight;
    varying float vBlink;
    varying float vScale;
    varying float vRotation;

    // Cubic ease out for smoother transition
    float easeOutCubic(float x) {
      return 1.0 - pow(1.0 - x, 3.0);
    }

    void main() {
      vScale = aRandomScale;
      vRotation = aRandomScale * 6.28; // Random 0-360 rotation
      
      // Calculate morph
      float p = easeOutCubic(uProgress);
      vec3 finalPos = mix(position, aTargetPos, p);
      
      // Add wind/breathing effect
      if (p > 0.8) {
        float wind = sin(uTime * 1.0 + finalPos.y * 0.5) * 0.2 * (finalPos.y / 15.0);
        finalPos.x += wind;
        finalPos.z += wind;
      }

      vHeight = finalPos.y;
      vBlink = sin(uTime * 2.0 + aRandomScale * 50.0);

      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      
      // SIZE: Massively increased for "Shard" aesthetic
      // Base size 250.0, varied by scale
      gl_PointSize = (250.0 * (0.6 + aRandomScale * 0.6)) * (1.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment Shader
  `
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    uniform vec3 uGold;
    
    varying float vHeight;
    varying float vBlink;
    varying float vScale;
    varying float vRotation;

    void main() {
      // 1. Rotate the coordinate space
      vec2 coord = gl_PointCoord - 0.5;
      float s = sin(vRotation);
      float c = cos(vRotation);
      mat2 rot = mat2(c, -s, s, c);
      coord = rot * coord;

      // 2. SHAPE: Irregular Diamond / Shard
      // We stretch one axis more than the other to make it look like a needle or shard
      // The randomness (vScale) affects the aspect ratio
      float aspect = 1.8 + vScale; 
      float d = abs(coord.x * aspect) + abs(coord.y);
      
      // 3. Cutoff - crisp edges
      if (d > 0.5) discard;

      // 4. Color Gradient
      float heightFactor = clamp((vHeight + 7.5) / 15.0, 0.0, 1.0);
      vec3 color = mix(uColorBase, uColorTip, heightFactor);

      // 5. Facet/Normal fake effect
      // Make one side slightly darker to simulate 3D depth on the 2D plane
      if (coord.x > 0.0) {
        color *= 0.85; 
      }

      // 6. Gold Sparkle
      if (vBlink > 0.95) {
        color = mix(color, uGold, 0.8);
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `
);

// --------------------------------------------------------
// Ribbon Material: Matte White Plush Fabric (Soft & Cozy)
// --------------------------------------------------------
export const FuzzyRibbonMaterial = shaderMaterial(
  {
    uReveal: 0,
  },
  // Vertex Shader
  `
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform float uReveal;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      // Reveal Animation: discard fragments above the reveal line
      // vUv.y goes from 0 (bottom) to 1 (top)
      if (vUv.y > uReveal) discard;
      
      // Pure Matte White Base (Dimmed by 10% -> 0.9)
      vec3 baseColor = vec3(0.9, 0.9, 0.9); 
      
      // Calculate Rim Light (Fresnel)
      float NdotV = dot(vNormal, vec3(0.0, 0.0, 1.0));
      
      // Soft Plush Rim effect: lighter at the edges
      float rim = 1.0 - max(NdotV, 0.0);
      rim = pow(rim, 2.0); // Adjust power to change plushness curve
      
      // Mix base color with a slightly brighter rim to simulate velvet/plush scattering
      vec3 finalColor = baseColor + vec3(rim * 0.4);

      // No glitter, no noise, just soft matte light response
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ FoliageMaterial, FuzzyRibbonMaterial });
