import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import Scene from './components/Scene';
import { TreeState } from './types';
import BackgroundAudio from './components/BackgroundAudio';
import GestureController from './components/GestureController';
// 引入数据库工具
import { initDB, saveFileToDB, getFileFromDB, getAllAudioFromDB, deleteFileFromDB } from './db';

// Initial Playlist
const INITIAL_PLAYLIST = [
  { title: "Jingle Bells", src: "https://cdn.pixabay.com/audio/2025/11/29/audio_d1c955f418.mp3" },
  { title: "Silent Night", src: "https://cdn.pixabay.com/audio/2022/11/28/audio_e9488e73e7.mp3" },
  { title: "Aurora-by Sappheiros", src: "http://music.163.com/song/media/outer/url?id=446875940.mp3" },
  { title: "We Wish You", src: "https://cdn.pixabay.com/audio/2025/11/29/audio_07d1c2152a.mp3" }
];

type PlayMode = 'sequence' | 'random' | 'loop_one';

const App: React.FC = () => {
  const [treeState, setTreeState] = useState<TreeState>(TreeState.CHAOS);
  const [isMuted, setIsMuted] = useState(false);
  
  // Gesture State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const gestureVelocityRef = useRef(0); 
  const gesturePosRef = useRef({ x: 0, y: 0 }); 

  // Audio Player State
  const [playlist, setPlaylist] = useState(INITIAL_PLAYLIST);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const [playMode, setPlayMode] = useState<PlayMode>('sequence');
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);

  // Ribbon & Image State
  const [isRibbonVisible, setIsRibbonVisible] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<{[key: number]: string}>({});
  const [uploadTargetIndex, setUploadTargetIndex] = useState<number | null>(null);
  
  // Viewing State
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [imageRotations, setImageRotations] = useState<{[key: number]: number}>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  
  // Camera State
  const [camDistance, setCamDistance] = useState(24);
  const [camPolarAngle, setCamPolarAngle] = useState(Math.PI / 2.2); 

  // 壁纸录制状态
  const [isWallpaperMode, setIsWallpaperMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // --- 1. 初始化：加载持久化数据 ---
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        await initDB(); 

        // A. 加载保存的图片
        const loadedImgs: {[key: number]: string} = {};
        for (let i = 0; i < 50; i++) {
          const blob = await getFileFromDB('images', i);
          if (blob) {
            loadedImgs[i] = URL.createObjectURL(blob);
          }
        }
        setUploadedImages(prev => ({ ...prev, ...loadedImgs }));

        // B. 加载保存的音乐
        const savedAudioFiles = await getAllAudioFromDB();
        if (savedAudioFiles.length > 0) {
          const newSongs = savedAudioFiles.map(item => ({
            title: item.key, 
            src: URL.createObjectURL(item.file)
          }));
          setPlaylist(prev => [...prev, ...newSongs]);
        }
      } catch (e) {
        console.error("Failed to load saved data:", e);
      }
    };

    loadSavedData();

    // Global Interaction Flag
    const handleInteraction = () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const toggleState = () => {
    setTreeState(prev => prev === TreeState.CHAOS ? TreeState.FORMED : TreeState.CHAOS);
  };

  const toggleRibbon = () => {
    setIsRibbonVisible(prev => !prev);
  };

  const toggleCamera = () => {
    setIsCameraActive(prev => !prev);
  };

  // --- GESTURE CALLBACKS ---
  const handleGestureSpin = (velocity: number) => {
    gestureVelocityRef.current += velocity;
  };

  const handleGestureMove = (x: number, y: number) => {
    gesturePosRef.current = { x, y };
  };

  const handleGestureStateChange = (newState: TreeState) => {
    if (newState !== treeState) {
        setTreeState(newState);
    }
  };

  // --- AUDIO Logic ---
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        const title = file.name.replace(/\.[^/.]+$/, "").substring(0, 15);
        
        await saveFileToDB('audio', title, file);

        const newSong = { title: title, src: url };
        setPlaylist(prev => [...prev, newSong]);
        setCurrentSongIndex(playlist.length); 
        setIsMusicPlaying(true);
    }
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  const deleteSong = async (e: React.MouseEvent, indexToDelete: number) => {
    e.stopPropagation();
    if (playlist.length <= 1) return;

    const songToDelete = playlist[indexToDelete];
    if (songToDelete.src.startsWith('blob:')) {
        await deleteFileFromDB('audio', songToDelete.title);
    }

    const newPlaylist = playlist.filter((_, idx) => idx !== indexToDelete);
    setPlaylist(newPlaylist);
    if (indexToDelete < currentSongIndex) setCurrentSongIndex(prev => prev - 1);
    else if (indexToDelete === currentSongIndex) setCurrentSongIndex(0); 
  };

  const playNextSong = () => {
    if (playMode === 'random') {
        const nextIndex = Math.floor(Math.random() * playlist.length);
        setCurrentSongIndex(nextIndex);
    } else {
        setCurrentSongIndex(prev => (prev + 1) % playlist.length);
    }
  };
  const playPrevSong = () => setCurrentSongIndex(prev => (prev - 1 + playlist.length) % playlist.length);
  const togglePlayMode = () => {
    const modes: PlayMode[] = ['sequence', 'random', 'loop_one'];
    const nextMode = modes[(modes.indexOf(playMode) + 1) % modes.length];
    setPlayMode(nextMode);
  };

  // --- IMAGE Logic ---
  const handleFrameClick = (index: number, hasImage: boolean) => { if (!hasImage) { setUploadTargetIndex(index); fileInputRef.current?.click(); } };
  const handleFrameDoubleClick = (index: number, hasImage: boolean) => { if (hasImage) setViewingIndex(index); };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && uploadTargetIndex !== null) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      
      await saveFileToDB('images', uploadTargetIndex, file);

      setUploadedImages(prev => ({ ...prev, [uploadTargetIndex]: url }));
      setImageRotations(prev => ({ ...prev, [uploadTargetIndex]: 0 }));
      setUploadTargetIndex(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const rotateImage = (e: React.MouseEvent) => { e.stopPropagation(); if (viewingIndex !== null) setImageRotations(prev => ({ ...prev, [viewingIndex]: ((prev[viewingIndex] || 0) + 90) % 360 })); };
  
  const replaceImage = (e: React.MouseEvent) => { e.stopPropagation(); if (viewingIndex !== null) { setUploadTargetIndex(viewingIndex); fileInputRef.current?.click(); } };

  // --- 新增：删除图片逻辑 ---
  const deleteImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewingIndex !== null) {
        // 1. 从数据库彻底删除
        await deleteFileFromDB('images', viewingIndex);

        // 2. 从状态中移除 (图片和旋转角度)
        setUploadedImages(prev => {
            const newState = { ...prev };
            delete newState[viewingIndex];
            return newState;
        });
        setImageRotations(prev => {
            const newState = { ...prev };
            delete newState[viewingIndex];
            return newState;
        });

        // 3. 关闭 Lightbox
        setViewingIndex(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (viewingIndex === null && !isWallpaperMode) {
      setCamDistance(prev => Math.min(Math.max(prev + e.deltaY * 0.02, 14), 36));
    }
  };

  const handleOrbit = (deltaY: number) => {
     if (!isWallpaperMode)
        setCamPolarAngle(prev => Math.min(Math.max(prev - deltaY * 0.01815, 0.01), Math.PI - 0.01));
  };

  const sliderValue = ((36 - camDistance) / 22) * 100;
  const currentRotation = viewingIndex !== null ? (imageRotations[viewingIndex] || 0) : 0;

  // --- 壁纸录制逻辑 ---
  const handleExportWallpaper = async () => {
    if (isRecording) return;
    const canvas = document.querySelector('canvas');
    if (!canvas) { alert("Error: Canvas not found."); return; }
    // @ts-ignore
    const streamFunc = canvas.captureStream || canvas.mozCaptureStream || canvas.webkitCaptureStream;
    if (!streamFunc) { alert("Your browser does not support canvas recording."); return; }

    console.log("Starting wallpaper recording...");
    setIsWallpaperMode(true); setIsMusicPlaying(false); setIsMuted(true); setIsCameraActive(false);
    setCamDistance(32); setCamPolarAngle(Math.PI / 2.2); 
    await new Promise(r => setTimeout(r, 1000));

    try {
        // @ts-ignore
        const stream = streamFunc.call(canvas, 60); 
        const mimeTypes = ['video/webm; codecs=vp9', 'video/webm; codecs=vp8', 'video/webm', 'video/mp4'];
        let selectedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
        if (!selectedMime) throw new Error("No supported video mime type found.");

        const recorder = new MediaRecorder(stream, { mimeType: selectedMime, videoBitsPerSecond: 12000000 });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: selectedMime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
            a.download = `Grand_Luxury_Tree_Wallpaper.${ext}`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setIsWallpaperMode(false); setIsRecording(false); setIsMuted(false); setIsMusicPlaying(true); setCamDistance(24); 
            alert("导出成功！");
        };
        recorder.onerror = (e) => { throw new Error("Recording error."); };
        setIsRecording(true);
        recorder.start();
        setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 13000); 
    } catch (e: any) {
        setIsWallpaperMode(false); setIsRecording(false); setIsMuted(false); setIsMusicPlaying(true);
        alert(`Export Failed: ${e.message}`);
    }
  };

  return (
    <>
      <style>{`
        .luxury-scrollbar::-webkit-scrollbar { width: 4px; }
        .luxury-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; }
        .luxury-scrollbar::-webkit-scrollbar-thumb { background: #cfc09f; border-radius: 2px; }
        .luxury-scrollbar::-webkit-scrollbar-thumb:hover { background: #ffecb3; }
      `}</style>

      <div 
        className="w-full h-screen relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#002211] via-[#00150a] to-[#000000]"
        onWheel={handleWheel}
      >
        {!isWallpaperMode && (
            <BackgroundAudio 
              isMuted={isMuted} 
              musicSrc={playlist[currentSongIndex]?.src}
              isMusicPlaying={isMusicPlaying}
              loopMusic={playMode === 'loop_one'}
              onMusicEnded={playNextSong}
            />
        )}

        {!isWallpaperMode && (
            <GestureController 
              isActive={isCameraActive}
              onSpinVelocity={handleGestureSpin}
              onPitchVelocity={handleOrbit}
              onHandMove={handleGestureMove}
              onStateChange={handleGestureStateChange}
              treeState={treeState}
            />
        )}

        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
        <input type="file" accept="audio/mp3, audio/*" ref={audioInputRef} onChange={handleAudioUpload} className="hidden" />

        <div className="absolute inset-0 z-0">
          <Canvas 
              shadows 
              dpr={[1, 2]} 
              gl={{ antialias: false, stencil: false, alpha: false, preserveDrawingBuffer: true }}
          >
            <Scene 
              treeState={treeState} 
              camDistance={camDistance} 
              camPolarAngle={camPolarAngle}
              ribbonVisible={isRibbonVisible}
              ribbonImages={uploadedImages}
              imageRotations={imageRotations}
              onFrameClick={handleFrameClick}
              onFrameDoubleClick={handleFrameDoubleClick}
              onOrbit={handleOrbit}
              gestureVelocityRef={gestureVelocityRef}
              gesturePosRef={gesturePosRef}
              isGestureActive={isCameraActive}
            />
          </Canvas>
        </div>

        {/* --- UI LAYER (Hidden in Wallpaper Mode) --- */}
        {!isWallpaperMode && (
          <>
            {/* Playlist Drawer */}
            <div className="absolute bottom-8 right-8 pointer-events-auto flex z-40 items-end">
              <div className={`absolute right-0 bottom-full mb-2 w-44 bg-[#0a0a0a]/95 border border-[#cfc09f] rounded-t-lg backdrop-blur-md shadow-2xl transition-all duration-500 origin-bottom-right overflow-hidden ${isPlaylistOpen ? 'h-48 opacity-100' : 'h-0 opacity-0'}`}>
                  <div className="p-2 border-b border-[#cfc09f]/30 flex justify-between items-center bg-[#cfc09f]/10">
                      <span className="text-[#cfc09f] text-[9px] font-serif tracking-widest">LIST ({playlist.length})</span>
                      <button onClick={() => audioInputRef.current?.click()} className="text-[9px] text-black bg-[#cfc09f] px-2 py-0.5 rounded hover:bg-white uppercase transition-colors">+ MP3</button>
                  </div>
                  <div className="luxury-scrollbar overflow-y-auto h-full p-2 pb-8 space-y-1">
                      {playlist.map((song, idx) => (
                        <div key={idx} onClick={() => { setCurrentSongIndex(idx); setIsMusicPlaying(true); }} className={`group relative p-1.5 text-[9px] cursor-pointer rounded flex justify-between items-center transition-all duration-200 ${idx === currentSongIndex ? 'bg-[#cfc09f] text-black font-bold shadow-[0_0_10px_rgba(207,192,159,0.3)]' : 'text-[#cfc09f] hover:bg-white/10'}`}>
                          <div className="flex items-center gap-1.5 truncate pr-6"><span className="opacity-50 min-w-[12px]">{idx + 1}.</span><span className="truncate">{song.title}</span></div>
                          {idx === currentSongIndex && <span className="animate-pulse">♪</span>}
                          <button onClick={(e) => deleteSong(e, idx)} className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 ml-1">×</button>
                        </div>
                      ))}
                  </div>
              </div>

              {/* Main Compact Player */}
              <div className="bg-[#050505]/95 border-2 border-[#cfc09f] rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.8)] relative z-50 flex flex-col w-44 overflow-hidden aspect-square justify-between">
                  <div className="bg-[#cfc09f]/10 p-2 flex flex-col gap-1 border-b border-[#cfc09f]/20 h-1/2 justify-center relative text-left">
                    <button onClick={() => setIsPlaylistOpen(!isPlaylistOpen)} className={`absolute top-2 right-2 border border-[#cfc09f] px-1.5 py-0.5 text-[8px] font-serif font-bold text-[#cfc09f] hover:bg-[#cfc09f] hover:text-black transition-colors rounded-sm ${isPlaylistOpen ? 'bg-[#cfc09f] text-black' : ''}`}>BGM</button>
                    <span className="text-[8px] text-[#cfc09f]/50 uppercase tracking-widest mt-1">Playing</span>
                    <div className="text-[#cfc09f] text-[10px] font-serif leading-tight font-medium line-clamp-2 pr-8">{playlist[currentSongIndex]?.title || "No Music"}</div>
                  </div>
                  <div className="flex flex-col gap-2 p-3 bg-gradient-to-b from-[#151515] to-black h-1/2 justify-center">
                    <div className="flex items-center justify-center gap-4">
                        <button onClick={playPrevSong} className="text-[#cfc09f] hover:text-white hover:scale-110 transition-transform"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
                        <button onClick={() => setIsMusicPlaying(!isMusicPlaying)} className="text-[#cfc09f] hover:text-white hover:scale-110 transition-transform">{isMusicPlaying ? <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}</button>
                        <button onClick={playNextSong} className="text-[#cfc09f] hover:text-white hover:scale-110 transition-transform"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
                    </div>
                    <div className="flex justify-center">
                        <button onClick={togglePlayMode} className="text-[#cfc09f]/50 hover:text-white transition-colors flex items-center gap-1 text-[8px] uppercase tracking-wider" title={playMode}>
                            {playMode === 'sequence' && <span>Sequence</span>} {playMode === 'random' && <span>Shuffle</span>} {playMode === 'loop_one' && <span>Loop One</span>}
                        </button>
                    </div>
                  </div>
              </div>
            </div>

            {/* Lightbox (Image Viewer) */}
            {viewingIndex !== null && uploadedImages[viewingIndex] && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-500" onClick={() => setViewingIndex(null)}>
                <div className="relative w-fit h-fit max-w-[90vw] max-h-[85vh] select-none" onClick={(e) => e.stopPropagation()} style={{ border: '24px solid transparent', borderImageSource: 'linear-gradient(135deg, #a67c00 0%, #ffea80 20%, #ffae00 40%, #7d5d00 60%, #ffea80 80%, #a67c00 100%)', borderImageSlice: 1, boxShadow: '0 0 0 4px #4d3900, inset 0 0 20px #000, 0 20px 50px rgba(0,0,0,0.9), 0 0 100px rgba(255, 174, 0, 0.4)' }}>
                  <div className="bg-[#101010] p-0 relative shadow-[inset_0_0_50px_rgba(0,0,0,1)] overflow-hidden">
                    <img src={uploadedImages[viewingIndex]} alt="Memory" className="block max-w-[80vw] max-h-[80vh] object-contain shadow-2xl transition-transform" style={{ transform: `rotate(${currentRotation}deg)` }} />
                  </div>
                  
                  {/* --- Lightbox Controls (Right Side) --- */}
                  <div className="absolute top-0 -right-20 flex flex-col gap-3 pointer-events-auto">
                      {/* Rotate Button */}
                      <button onClick={rotateImage} className="w-14 h-14 bg-black/80 border border-[#cfc09f] text-[#cfc09f] flex items-center justify-center rounded shadow-lg hover:bg-[#cfc09f] hover:text-black transition-all" title="Rotate">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                      </button>
                      
                      {/* Replace Button */}
                      <button onClick={replaceImage} className="w-14 h-14 bg-black/80 border border-[#cfc09f] text-[#cfc09f] flex items-center justify-center rounded shadow-lg hover:bg-[#cfc09f] hover:text-black transition-all" title="Replace">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                      </button>

                      {/* --- [新增] Delete Button --- */}
                      <button onClick={deleteImage} className="w-14 h-14 bg-black/80 border border-[#cfc09f] text-[#cfc09f] flex items-center justify-center rounded shadow-lg hover:bg-red-900/80 hover:text-white hover:border-red-500 transition-all" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                  </div>
                  
                  {/* Close Button (Top Right) */}
                  <button onClick={() => setViewingIndex(null)} className="absolute -top-12 -right-12 text-[#cfc09f] hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 drop-shadow-lg"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-8">
              <header className="text-center">
                <h1 className="text-4xl md:text-6xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-[#cfc09f] via-[#ffecb3] to-[#cfc09f] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-widest uppercase">Merry Christmas</h1>
                <h2 className="text-xl md:text-2xl font-light text-emerald-400 mt-2 tracking-[0.5em] uppercase opacity-80">Interactive Tree</h2>
              </header>

              <div className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-auto flex flex-col gap-4">
                <button onClick={toggleRibbon} className={`w-12 h-12 flex items-center justify-center rounded-full border border-[#cfc09f] transition-all duration-300 backdrop-blur-sm ${isRibbonVisible ? 'bg-[#cfc09f]/20' : 'bg-black/40'} hover:scale-110`} title="Toggle Ribbon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#cfc09f" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
                <button onClick={toggleCamera} className={`w-12 h-12 flex items-center justify-center rounded-full border border-[#cfc09f] transition-all duration-300 backdrop-blur-sm ${isCameraActive ? 'bg-red-500/20 border-red-400 animate-pulse' : 'bg-black/40'} hover:scale-110`} title="Toggle Hand Gestures">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={isCameraActive ? "#fca5a5" : "#cfc09f"} className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                </button>
              </div>

              <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center gap-4 hidden md:flex">
                <span className="text-[#cfc09f] text-xs tracking-widest uppercase rotate-90 mb-8">Zoom</span>
                <div className="h-48 w-1 bg-[#cfc09f]/20 rounded-full relative group">
                  <input type="range" min="0" max="100" value={sliderValue} onChange={(e) => setCamDistance(36 - (parseFloat(e.target.value) / 100) * 22)} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-12 opacity-0 cursor-pointer z-20 -rotate-90 origin-center"/>
                  <div className="absolute bottom-0 w-full bg-[#cfc09f] rounded-full transition-all duration-100" style={{ height: `${sliderValue}%` }}></div>
                  <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-[#cfc09f] rotate-45 border-2 border-[#050505] shadow-[0_0_10px_#cfc09f] transition-all duration-100" style={{ bottom: `calc(${sliderValue}% - 8px)` }}></div>
                </div>
              </div>

              <div className="pointer-events-auto flex flex-col items-center gap-6 mb-8">
                <p className="text-xs text-[#cfc09f] tracking-widest uppercase mb-2 animate-pulse">{isCameraActive ? "Gesture Control Active" : "Drag up/down to Look • Swipe to Spin"}</p>
                <button onClick={toggleState} className={`relative group px-12 py-4 border border-[#cfc09f] overflow-hidden transition-all duration-500 ${treeState === TreeState.FORMED ? 'bg-[#cfc09f]/10' : 'bg-transparent'}`}>
                  <div className="absolute inset-0 w-0 bg-[#cfc09f] transition-all duration-[250ms] ease-out group-hover:w-full opacity-20"></div>
                  <span className="relative z-10 font-serif text-lg tracking-widest text-[#cfc09f] group-hover:text-white transition-colors duration-300">{treeState === TreeState.CHAOS ? "ASSEMBLE THE MAJESTY" : "RELEASE TO CHAOS"}</span>
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#ffecb3]"></div>
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#ffecb3]"></div>
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#ffecb3]"></div>
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#ffecb3]"></div>
                </button>
              </div>

              {/* [新增] 导出壁纸按钮 */}
              <div className="absolute bottom-8 left-8 pointer-events-auto z-50">
                <button 
                    onClick={handleExportWallpaper}
                    className="border border-[#cfc09f] text-[#cfc09f] px-3 py-1.5 rounded hover:bg-[#cfc09f] hover:text-black transition-colors font-serif text-[10px] tracking-widest uppercase flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                    Export Wallpaper
                </button>
              </div>
            </div>
          </>
        )}

        {isRecording && (
            <div className="absolute top-8 right-8 text-red-500 font-bold animate-pulse z-50 tracking-widest bg-black/50 px-4 py-2 rounded">
                ● RECORDING... DO NOT MOVE MOUSE
            </div>
        )}
      </div>
    </>
  );
};

export default App;