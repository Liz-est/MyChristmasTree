import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const AnimatedGroup = animated.group as any;

// --- 1. 配置在线音频资源 ---
// 只要替换这里的 url，所有人下载代码后都能听到一样的声音，无需配置本地环境
const GREETINGS_DATA = [
  { 
    text: "May the magic of Christmas wrap you in warmth, and the carols of angels sing peace into your heart all year long.", 
    // 示例链接：TTSMaker 生成的深情男声
    url: "https://github.com/Liz-est/Christmas-tree-voice/raw/refs/heads/main/ElevenLabs_2025-12-22T03_55_52_Wyatt-%20Wise%20Rustic%20Cowboy_pvc_sp97_s100_sb100_se45_b_m2.mp3" 
  },
  { 
    text: "As the evergreen holds its color through winter, may hope and kindness remain evergreen in your heart.", 
    url: "https://github.com/Liz-est/Christmas-tree-voice/raw/refs/heads/main/ElevenLabs_2025-12-22T04_00_01_Wyatt-%20Wise%20Rustic%20Cowboy_pvc_sp85_s100_sb100_se45_b_m2.mp3" 
  },
  { 
    text: "Christmas is not a time nor a season, but a state of mind. To cherish peace and goodwill, to be plenteous in mercy, is to have the real spirit of Christmas.", 
    url: "https://github.com/Liz-est/Christmas-tree-voice/raw/refs/heads/main/ElevenLabs_2025-12-22T04_04_54_Wyatt-%20Wise%20Rustic%20Cowboy_pvc_sp89_s100_sb100_se45_b_m2.mp3" 
  },
  { 
    text: "Christmas is a season for kindling the fire of hospitality in the hall, the genial flame of charity in the heart", 
    url: "https://github.com/Liz-est/Christmas-tree-voice/raw/refs/heads/main/ElevenLabs_2025-12-22T04_54_54_Amelia%20-%20Enthusiastic%20and%20Expressive_pvc_sp106_s50_sb48_se0_m2.mp3" 
  },
  { 
    text: "May the Christmas spirit of love and joy surround you and your family.", 
    url: "https://github.com/Liz-est/Christmas-tree-voice/raw/refs/heads/main/ElevenLabs_2025-12-22T04_47_10_Cherry%20Twinkle%20-%20Bubbly%20and%20Sweet_pvc_sp102_s50_sb75_se61_b_m2.mp3" 
  },
  { 
    text: "Wishing you a season where time slows like falling snow, allowing you to gather the love and light that truly matter.", 
    url: "https://github.com/Liz-est/Christmas-tree-voice/raw/refs/heads/main/ElevenLabs_2025-12-22T04_45_39_Priyanka%20-%20Calm,%20Neutral%20and%20Relaxed_pvc_sp88_s59_sb100_se0_b_m2.mp3" 
  }
];

// --- 几何算法 (保持稳定) ---
const createVelvetGeometry = (type: 'cone' | 'torus' | 'sphere', count: number, colorHex: string) => {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const baseColor = new THREE.Color(colorHex);
  const tempColor = new THREE.Color();
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;
    if (type === 'cone') {
      const h = Math.random() * 2.5; const r = (1 - h / 2.5) * 1.0; const theta = Math.random() * Math.PI * 2;
      x = r * (0.8 + 0.2 * Math.random()) * Math.cos(theta); y = h; z = r * (0.8 + 0.2 * Math.random()) * Math.sin(theta);
    } else if (type === 'torus') {
      const u = Math.random() * Math.PI * 2; const v = Math.random() * Math.PI * 2; const r = 0.65 * (0.7 + 0.3 * Math.random()); 
      x = (1.0 + r * Math.cos(v)) * Math.cos(u); z = (1.0 + r * Math.cos(v)) * Math.sin(u); y = r * Math.sin(v) * 0.7; 
    } else {
      const r = 0.5 * Math.cbrt(Math.random()); const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1);
      x = r * Math.sin(phi) * Math.cos(theta); y = r * Math.sin(phi) * Math.sin(theta); z = r * Math.cos(phi);
    }
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    tempColor.set(baseColor).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
    colors[i * 3] = tempColor.r; colors[i * 3 + 1] = tempColor.g; colors[i * 3 + 2] = tempColor.b;
    sizes[i] = Math.random() * 1.5 + 0.5;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  return geometry;
};

const VelvetParticleMesh: React.FC<{ geometry: THREE.BufferGeometry; size: number; order: number }> = ({ geometry, size, order }) => (
  <points geometry={geometry} renderOrder={order}>
    <pointsMaterial vertexColors size={size} sizeAttenuation transparent opacity={1.0} blending={THREE.NormalBlending} depthWrite={false} depthTest={true} />
  </points>
);

const SantaHat: React.FC<any> = ({ anchorRef, focused, onOpen, onClose, onHoverChange, renderOrder = 100 }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  
  const visualGroupRef = useRef<THREE.Group>(null);
  const colliderRef = useRef<THREE.Mesh>(null);
  
  // 2. 使用 Audio 对象代替 SpeechSynthesis
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const coneGeo = useMemo(() => createVelvetGeometry('cone', 12000, "#c41e3a"), []); 
  const torusGeo = useMemo(() => createVelvetGeometry('torus', 9000, "#f8f9fa"), []); 
  const ballGeo = useMemo(() => createVelvetGeometry('sphere', 3500, "#f8f9fa"), []);

  const [springs, api] = useSpring(() => ({
    position: [2.5, 10.5, 6.0], rotation: [0, 0, -0.2], scale: 1,
    config: { mass: 1, tension: 170, friction: 26 }
  }));

  // --- 3. 播放逻辑重构 ---
  const speak = useCallback(() => {
    // 停止上一句
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }

    // 随机选择
    const item = GREETINGS_DATA[Math.floor(Math.random() * GREETINGS_DATA.length)];
    
    // 设置字幕
    setSubtitle(item.text); 

    // 创建并播放音频
    // 注意：这里的 URL 是在线链接，所以任何下载了 App 的人都能直接听到
    const audio = new Audio(item.url);
    audio.volume = 1.0;
    
    // 监听状态以驱动帽子动画
    audio.onplay = () => setIsSpeaking(true);
    audio.onended = () => setIsSpeaking(false);
    audio.onerror = (e) => {
        console.error("Audio Load Error:", e);
        setIsSpeaking(false);
    };

    audio.play().catch(e => console.warn("Autoplay prevented:", e));
    audioRef.current = audio;

  }, []);

  useFrame((state) => {
    if (anchorRef.current) {
        const worldPos = new THREE.Vector3();
        anchorRef.current.getWorldPosition(worldPos);
        api.set({ 
            position: [worldPos.x, worldPos.y, worldPos.z], 
            rotation: [0, 0, -0.2], 
            scale: focused ? 2.5 : 1.0 
        });
    }
    if (visualGroupRef.current) {
        const t = state.clock.getElapsedTime();
        // 说话时缩放，模拟呼吸
        const baseScale = focused ? 2.5 : 1.0;
        let scaleOffset = 0;
        if (isSpeaking) {
            scaleOffset = Math.sin(t * 10) * 0.05;
        }
        visualGroupRef.current.scale.setScalar(1 + scaleOffset / baseScale); // 修正缩放逻辑
    }
  });

  // 状态同步
  useEffect(() => {
    if (focused) {
        speak();
    } else {
        setSubtitle("");
        setIsSpeaking(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }
  }, [focused, speak]);

  return (
    <group renderOrder={renderOrder}>
      <AnimatedGroup position={springs.position} rotation={springs.rotation} scale={springs.scale}>
        
        {/* 交互检测球 */}
        <mesh 
            ref={colliderRef}
            renderOrder={999999} 
            onPointerDown={(e: any) => { 
                e.stopPropagation(); 
                if (!focused) onOpen(); 
                // focused 时点帽子不触发 speak，只靠点字幕触发
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; onHoverChange && onHoverChange(true); }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; onHoverChange && onHoverChange(false); }}
            position={[0, 1.2, 0]}
        >
           <sphereGeometry args={[2.8, 16, 16]} />
           <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
        </mesh>

        <group ref={visualGroupRef} raycast={null}>
            <VelvetParticleMesh geometry={coneGeo} size={0.045} order={renderOrder}/>
            <VelvetParticleMesh geometry={torusGeo} size={0.055} order={renderOrder}/>
            <group position={[0, 2.4, 0]} rotation={[0, 0, -0.6]}>
                <group position={[0.45, 0, 0]}><VelvetParticleMesh geometry={ballGeo} size={0.05} order={renderOrder}/></group>
            </group>
        </group>

        {/* 字幕 UI */}
        <Html fullscreen style={{ pointerEvents: 'none' }}>
           {focused && subtitle && (
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '75%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none'
              }}>
                <div style={{ position: 'relative' }}>
                    
                    {/* 关闭按钮 */}
                    <div
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        style={{
                            position: 'absolute',
                            top: '-15px',
                            right: '-15px',
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: '#000', 
                            border: '2px solid #D4AF37', 
                            boxShadow: '0 0 15px rgba(212, 175, 55, 0.6)', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#D4AF37', 
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            zIndex: 1000,
                            fontFamily: 'serif'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        ✕
                    </div>

                    {/* 字幕框 - 点击切歌 */}
                    <div 
                      onClick={(e) => { e.stopPropagation(); speak(); }}
                      style={{
                        width: '320px',
                        padding: '20px 30px',
                        background: 'rgba(0, 0, 0, 0.75)', 
                        backdropFilter: 'blur(12px)',       
                        border: '1px solid rgba(255, 255, 255, 0.15)', 
                        borderRadius: '16px',
                        color: '#e0e0e0',
                        fontFamily: '"Times New Roman", Times, serif', 
                        fontSize: '16px',
                        fontWeight: '400',
                        textAlign: 'center',
                        lineHeight: '1.6',
                        cursor: 'pointer', 
                        pointerEvents: 'auto', 
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '3px', marginBottom: '12px', opacity: 0.6 }}>
                          {[1, 2, 3, 2, 1].map((h, i) => (
                              <div key={i} style={{ width: '2px', height: `${h * 4}px`, background: '#fff' }} />
                          ))}
                      </div>
                      {subtitle}
                      <div style={{ marginTop: '10px', fontSize: '10px', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '2px', fontFamily: 'sans-serif' }}>
                          tap to next
                      </div>
                    </div>
                </div>
              </div>
           )}
        </Html>
      </AnimatedGroup>
    </group>
  );
};

export default SantaHat;