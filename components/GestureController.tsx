import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { TreeState } from '../types';

interface GestureControllerProps {
  onSpinVelocity: (velocity: number) => void;
  onPitchVelocity: (velocity: number) => void;
  onHandMove: (x: number, y: number) => void;
  onStateChange: (state: TreeState) => void;
  isActive: boolean;
  treeState: TreeState; // 必须接收父组件的状态
}

const GestureController: React.FC<GestureControllerProps> = ({ 
  onSpinVelocity, 
  onPitchVelocity,
  onHandMove, 
  onStateChange,
  isActive,
  treeState 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [debugStatus, setDebugStatus] = useState<string>("Initializing...");

  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  
  const lastIndexX = useRef<number | null>(null);
  const lastIndexY = useRef<number | null>(null);
  
  const lastGestureState = useRef<TreeState | null>(null);
  const gestureFrames = useRef(0);

  // --- 状态锁 ---
  const isArmedRef = useRef(false);
  const needsResetRef = useRef(false);

  // 闭包陷阱修复
  const onSpinVelocityRef = useRef(onSpinVelocity);
  const onPitchVelocityRef = useRef(onPitchVelocity);
  const onHandMoveRef = useRef(onHandMove);
  const onStateChangeRef = useRef(onStateChange);
  const currentTreeStateRef = useRef(treeState);

  useEffect(() => {
    onSpinVelocityRef.current = onSpinVelocity;
    onPitchVelocityRef.current = onPitchVelocity;
    onHandMoveRef.current = onHandMove;
    onStateChangeRef.current = onStateChange;
    currentTreeStateRef.current = treeState;
  }, [onSpinVelocity, onPitchVelocity, onHandMove, onStateChange, treeState]);

  useEffect(() => {
    if (!isActive) return;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setLoaded(true);
        startCamera();
      } catch (e) {
        console.error("MediaPipe Init Error:", e);
        setDebugStatus("Error loading AI");
      }
    };
    init();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(requestRef.current);
    };
  }, [isActive]);

  const startCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", predictWebcam);
        }
      } catch (err) {
        console.error("Camera Error:", err);
        setDebugStatus("Camera Error");
      }
    }
  };

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current) return;

    const startTimeMs = performance.now();
    const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      
      // === 1. 金粉跟随 ===
      const indexTip = landmarks[8];
      const ndcX = (1 - indexTip.x) * 2 - 1; 
      const ndcY = -((indexTip.y * 2) - 1);
      onHandMoveRef.current(ndcX, ndcY);

      // === 2. 运动控制 ===
      let moveStatus = "";
      if (lastIndexX.current !== null && lastIndexY.current !== null) {
        const deltaX = ndcX - lastIndexX.current;
        const deltaY = ndcY - lastIndexY.current;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const MOVEMENT_THRESHOLD = 0.005; 

        if (absX > MOVEMENT_THRESHOLD || absY > MOVEMENT_THRESHOLD) {
            if (absX > absY) {
                onSpinVelocityRef.current(deltaX * 0.15); 
                moveStatus = "SWIPE X";
            } else {
                onPitchVelocityRef.current(-deltaY * 150); 
                moveStatus = "SWIPE Y";
            }
        }
      }
      lastIndexX.current = ndcX;
      lastIndexY.current = ndcY;

      // === 3. 握拳/张开 检测 ===
      const wrist = landmarks[0];
      const middleBase = landmarks[9];
      const palmSize = Math.hypot(middleBase.x - wrist.x, middleBase.y - wrist.y);

      const fingers = [
          { tip: 8, base: 5 }, { tip: 12, base: 9 }, 
          { tip: 16, base: 13 }, { tip: 20, base: 17 } 
      ];
      let foldedCount = 0;
      let totalTipDist = 0;
      fingers.forEach(f => {
          const tip = landmarks[f.tip];
          const base = landmarks[f.base];
          const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
          const distBase = Math.hypot(base.x - wrist.x, base.y - wrist.y);
          totalTipDist += distTip;
          if (distTip < distBase * 1.1) foldedCount++;
      });
      const avgTipDist = totalTipDist / 4;
      const expansionRatio = avgTipDist / palmSize;

      const isFist = foldedCount >= 3;
      // 宽松判定：只要有一点张开的迹象，或者手指没怎么折叠，都算张开
      const isOpen = foldedCount <= 1 || expansionRatio > 1.2;

      // === 4. 状态机逻辑 (瞬间响应版) ===
      
      let targetState: TreeState | null = null;
      let statusText = `F:${foldedCount}`;

      const currentState = currentTreeStateRef.current; // 获取最新的树状态

      // 如果 App.tsx 没传这个参数，这里是 undefined，下面逻辑会全挂
      if (currentState === undefined) {
          statusText = "ERR: Missing treeState prop!";
      } else {
          if (isFist) {
              if (currentState === TreeState.CHAOS) {
                  // 散开 -> 握拳 -> 聚拢
                  targetState = TreeState.FORMED;
                  isArmedRef.current = false; 
                  needsResetRef.current = true; // 锁定
                  statusText = "✊ GATHERING";
              } else {
                  // 已经是聚拢状态
                  if (needsResetRef.current) {
                      statusText = "✊ HOLDING... (Release)";
                  } else {
                      // 激活保险
                      isArmedRef.current = true;
                      statusText = "✊ ARMED (Ready)";
                  }
              }
          } else {
              // 手松开了
              if (!isFist) {
                  needsResetRef.current = false; // 解除锁定
              }

              if (isOpen) {
                  if (currentState === TreeState.FORMED) {
                      if (isArmedRef.current) {
                          // **瞬间触发**：不需要防抖，直接炸开
                          onStateChangeRef.current(TreeState.CHAOS);
                          isArmedRef.current = false;
                          lastGestureState.current = TreeState.CHAOS; // 强制更新内部状态
                          statusText = "🖐 SCATTER!";
                          // 立即返回，跳过下面的常规防抖逻辑
                          setDebugStatus(statusText);
                          requestRef.current = requestAnimationFrame(predictWebcam);
                          return; 
                      } else {
                          statusText = "🖐 WAITING (Clench to Arm)";
                      }
                  } else {
                      statusText = "🖐 IDLE";
                  }
              }
          }
      }

      setDebugStatus(moveStatus ? moveStatus : statusText);

      // 常规状态变更 (带防抖，用于聚拢)
      if (targetState && targetState !== lastGestureState.current) {
        gestureFrames.current++;
        if (gestureFrames.current > 2) {
            onStateChangeRef.current(targetState);
            lastGestureState.current = targetState;
            gestureFrames.current = 0;
        }
      } else {
        gestureFrames.current = 0;
      }

    } else {
        lastIndexX.current = null;
        lastIndexY.current = null;
        setDebugStatus("No Hand");
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className={`fixed bottom-4 left-4 z-50 border border-[#cfc09f] bg-black/80 backdrop-blur-md rounded-lg overflow-hidden transition-all duration-500 shadow-[0_0_15px_rgba(207,192,159,0.3)] ${isActive ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-10 pointer-events-none'}`}>
      <div className="relative">
        <video
            ref={videoRef}
            className="w-32 h-24 object-cover transform -scale-x-100 opacity-80"
            autoPlay
            playsInline
        />
        <div className="absolute top-1 left-2 text-[8px] text-[#cfc09f] font-serif tracking-widest uppercase shadow-black drop-shadow-md">
            AI Vision
        </div>
        <div className="absolute bottom-0 inset-x-0 bg-black/70 p-1 text-center border-t border-[#cfc09f]/30">
             <span className={`text-[10px] font-bold tracking-wider ${debugStatus.includes("GATHER") ? "text-emerald-400" : debugStatus.includes("SCATTER") ? "text-blue-400" : debugStatus.includes("ARMED") ? "text-red-500" : debugStatus.includes("ERR") ? "text-red-600 bg-white" : "text-[#cfc09f]"}`}>
                {debugStatus}
             </span>
        </div>
        {!loaded && isActive && <div className="absolute inset-0 flex items-center justify-center text-[#cfc09f] text-[10px] bg-black/50">Loading...</div>}
      </div>
    </div>
  );
};

export default GestureController;