
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { PLAYER_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../constants';
import { useAppContext } from '../context/AppContext';

// Custom hook for voice activity detection
const useVoiceActivity = (stream: MediaStream | null) => {
    const [volume, setVolume] = useState(0);

    useEffect(() => {
        if (!stream || stream.getAudioTracks().length === 0) {
            setVolume(0);
            return;
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let animationFrameId: number;

        const updateVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
            setVolume(average);
            animationFrameId = requestAnimationFrame(updateVolume);
        };

        animationFrameId = requestAnimationFrame(updateVolume);

        return () => {
            cancelAnimationFrame(animationFrameId);
            source.disconnect();
            analyser.disconnect();
            audioContext.close();
        };
    }, [stream]);

    return volume;
};

interface AvatarProps {
  user: User;
  isYou: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ user, isYou }) => {
  const { state } = useAppContext();
  const { position, avatar, name } = user;
  
  const isWhisperTarget = state.whisperingTo === user.id;
  const isWhisperInitiator = isYou && state.whisperingTo !== null && state.otherUsers.some(u => u.id === state.whisperingTo);
  const showWhisperIndicator = isWhisperTarget || isWhisperInitiator;

  const volume = useVoiceActivity(isYou ? state.localStream : null);
  const speakingThreshold = 5;
  const isSpeaking = volume > speakingThreshold && state.isMicOn;
  
  // More prominent visual effect for speaking
  const glowSpread = isSpeaking ? Math.min(25, volume / 4) : 0;
  const glowBlur = glowSpread * 2;
  const ringStyle = {
      boxShadow: `0 0 ${glowBlur}px ${glowSpread}px rgba(74, 222, 128, 0.7)`,
      transition: 'box-shadow 0.1s linear'
  };

  return (
    <div
      className="absolute transition-all duration-300 ease-in-out flex flex-col items-center group cursor-pointer"
      style={{
        left: `${(position.x / MAP_WIDTH) * 100}%`,
        top: `${(position.y / MAP_HEIGHT) * 100}%`,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        zIndex: isYou ? 10 : 5
      }}
    >
      <div className={`absolute -top-6 w-max px-2 py-0.5 text-sm rounded-md bg-black bg-opacity-60 transition-opacity duration-200 ${isYou ? '' : 'opacity-0 group-hover:opacity-100'}`}>
        {name}
      </div>
      <div 
        className="relative w-full h-full rounded-full border-2 border-black" 
        style={{ 
          backgroundColor: avatar.color,
          ...(showWhisperIndicator ? { boxShadow: '0 0 15px 5px rgba(192, 132, 252, 0.7)' } : ringStyle),
        }}
      >
        {showWhisperIndicator && <div className="absolute inset-0 rounded-full ring-4 ring-purple-400 animate-pulse"></div>}
      </div>
      {isYou && <div className="absolute -bottom-1 w-2 h-2 bg-green-400 rounded-full" />}
    </div>
  );
};

export default Avatar;