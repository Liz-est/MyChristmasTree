import React, { useEffect, useRef } from 'react';

interface BackgroundAudioProps {
  isMuted: boolean;
  musicSrc: string; 
  isMusicPlaying: boolean;
  loopMusic: boolean;
  onMusicEnded: () => void;
}

const BackgroundAudio: React.FC<BackgroundAudioProps> = ({ 
  isMuted, 
  musicSrc, 
  isMusicPlaying, 
  loopMusic,
  onMusicEnded 
}) => {
  const musicRef = useRef<HTMLAudioElement>(null);
  const ambienceRef = useRef<HTMLAudioElement>(null);
  
  // Track latest state for use in internal callbacks
  const isPlayingRef = useRef(isMusicPlaying);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isPlayingRef.current = isMusicPlaying;
    isMutedRef.current = isMuted;

    // Handle music element specifically on prop change
    if (musicRef.current) {
      if (!isMusicPlaying || isMuted) {
        musicRef.current.pause();
      } else {
        musicRef.current.play().catch(() => {
          // Expected block until user interaction
        });
      }
    }

    if (ambienceRef.current) {
        if (isMuted) ambienceRef.current.pause();
        else ambienceRef.current.play().catch(() => {});
    }
  }, [isMusicPlaying, isMuted, musicSrc]);

  useEffect(() => {
    // Initial setup
    const setup = () => {
      if (musicRef.current) musicRef.current.volume = 0.4;
      if (ambienceRef.current) ambienceRef.current.volume = 0.5;
    };
    setup();

    const unlock = () => {
      if (isPlayingRef.current && !isMutedRef.current) {
        musicRef.current?.play().catch(() => {});
      }
      if (!isMutedRef.current) {
        ambienceRef.current?.play().catch(() => {});
      }
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };

    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);

    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  return (
    <div style={{ display: 'none' }}>
      {musicSrc && (
        <audio
          ref={musicRef}
          key={musicSrc} 
          src={musicSrc}
          loop={loopMusic} 
          onEnded={onMusicEnded}
          playsInline
          preload="auto"
        />
      )}
      <audio
        ref={ambienceRef}
        loop
        playsInline
        preload="auto"
      />
    </div>
  );
};

export default BackgroundAudio;