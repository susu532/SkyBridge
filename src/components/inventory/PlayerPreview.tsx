import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { generateSkin } from '../../game/SkinManager';
import { settingsManager } from '../../game/Settings';

export const PlayerPreview = ({ scale = 6 }: { scale?: number }) => {
  const [skinUrl, setSkinUrl] = useState<string>('');

  useEffect(() => {
    const renderSkin = () => {
      const username = settingsManager.getSettings().username || 'player';
      const texture = generateSkin(localStorage.getItem('skyBridge_skin_seed') || username);
      if (texture && texture.image instanceof HTMLCanvasElement) {
        setSkinUrl(texture.image.toDataURL());
      }
    };
    renderSkin();
  }, []);

  if (!skinUrl) {
    return (
      <div className="w-24 sm:w-32 h-32 sm:h-48 flex items-center justify-center text-[#373737] font-bold text-sm sm:text-base bg-black/20 rounded shadow-inner">
        Player
      </div>
    );
  }

  const Part = ({ x, y, w, h, outX, outY, left, top, zIndex = 1 }: any) => (
    <div style={{
      position: 'absolute',
      left: left * scale,
      top: top * scale,
      width: w * scale,
      height: h * scale,
      zIndex
    }}>
      <div style={{
        position: 'absolute',
        width: '100%', height: '100%',
        backgroundImage: `url(${skinUrl})`,
        backgroundSize: `${64 * scale}px ${64 * scale}px`,
        backgroundPosition: `-${x * scale}px -${y * scale}px`,
        imageRendering: 'pixelated'
      }} />
      {outX !== undefined && (
        <div style={{
          position: 'absolute',
          width: '100%', height: '100%',
          backgroundImage: `url(${skinUrl})`,
          backgroundSize: `${64 * scale}px ${64 * scale}px`,
          backgroundPosition: `-${outX * scale}px -${outY * scale}px`,
          imageRendering: 'pixelated'
        }} />
      )}
    </div>
  );

  return (
    <div className="flex items-center justify-center w-24 sm:w-32 h-32 sm:h-48 overflow-hidden bg-black/20 rounded border-2 border-[#1a1a1a]/40 shadow-inner">
      <div style={{ position: 'relative', width: 16 * scale, height: 32 * scale }}>
        <Part left={4} top={0} w={8} h={8} x={8} y={8} outX={40} outY={8} zIndex={3} /> {/* Head */}
        <Part left={4} top={8} w={8} h={12} x={20} y={20} outX={20} outY={36} zIndex={2} /> {/* Body */}
        <Part left={0} top={8} w={4} h={12} x={44} y={20} outX={44} outY={36} zIndex={4} /> {/* Right Arm (Screen left) */}
        <Part left={12} top={8} w={4} h={12} x={36} y={52} outX={52} outY={52} zIndex={4} /> {/* Left Arm (Screen right) */}
        <Part left={4} top={20} w={4} h={12} x={4} y={20} outX={4} outY={36} zIndex={1} /> {/* Right Leg (Screen left) */}
        <Part left={8} top={20} w={4} h={12} x={20} y={52} outX={4} outY={52} zIndex={1} /> {/* Left Leg (Screen right) */}
      </div>
    </div>
  );
};
