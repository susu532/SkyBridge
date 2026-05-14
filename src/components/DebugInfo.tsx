import React, { useEffect, useRef } from 'react';
import { Game } from '../game/Game';

interface DebugInfoProps {
  game: Game | null;
  showDebug: boolean;
}

export const DebugInfo: React.FC<DebugInfoProps> = ({ game, showDebug }) => {
  const coordRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const chunkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDebug || !game) return;

    let frameId: number;
    let lastX = 0, lastY = 0, lastZ = 0;
    
    const updateCoords = () => {
      const pos = game.player.position;
      
      // Only update DOM if position changed significantly to save DOM writes
      if (Math.abs(pos.x - lastX) > 0.001 || Math.abs(pos.y - lastY) > 0.001 || Math.abs(pos.z - lastZ) > 0.001) {
        lastX = pos.x;
        lastY = pos.y;
        lastZ = pos.z;
        
        if (coordRef.current) {
          coordRef.current.innerText = `XYZ: ${pos.x.toFixed(3)} / ${pos.y.toFixed(3)} / ${pos.z.toFixed(3)}`;
        }
        if (blockRef.current) {
          blockRef.current.innerText = `Block: ${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}`;
        }
        if (chunkRef.current) {
          chunkRef.current.innerText = `Chunk: ${Math.floor(pos.x / 16)} ${Math.floor(pos.z / 16)}`;
        }
      }
      
      frameId = requestAnimationFrame(updateCoords);
    };

    frameId = requestAnimationFrame(updateCoords);
    return () => cancelAnimationFrame(frameId);
  }, [showDebug, game]);

  if (!showDebug) return null;

  return (
    <div className="absolute top-4 left-4 text-white font-mono text-sm bg-black/60 p-3 rounded-lg pointer-events-none border border-white/20 shadow-xl">
      <div className="text-green-400 font-bold mb-1 border-b border-white/10 pb-1">DEBUG INFO</div>
      <div className="space-y-0.5">
        <div ref={coordRef}>XYZ: 0.000 / 0.000 / 0.000</div>
        <div ref={blockRef}>Block: 0 0 0</div>
        <div ref={chunkRef}>Chunk: 0 0</div>
      </div>
    </div>
  );
};
