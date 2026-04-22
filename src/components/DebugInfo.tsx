import React, { useEffect, useState } from 'react';
import { Game } from '../game/Game';

interface DebugInfoProps {
  game: Game | null;
  showDebug: boolean;
}

export const DebugInfo: React.FC<DebugInfoProps> = ({ game, showDebug }) => {
  const [coords, setCoords] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    if (!showDebug || !game) return;

    let frameId: number;
    const updateCoords = () => {
      const pos = game.player.position;
      setCoords({ x: pos.x, y: pos.y, z: pos.z });
      frameId = requestAnimationFrame(updateCoords);
    };

    frameId = requestAnimationFrame(updateCoords);
    return () => cancelAnimationFrame(frameId);
  }, [showDebug, game]);

  if (!showDebug) return null;

  return (
    <div className="absolute top-4 left-4 text-white font-mono text-sm bg-black/60 p-3 rounded-lg pointer-events-none backdrop-blur-md border border-white/20 shadow-xl">
      <div className="text-green-400 font-bold mb-1 border-b border-white/10 pb-1">DEBUG INFO</div>
      <div className="space-y-0.5">
        <div>XYZ: {coords.x.toFixed(3)} / {coords.y.toFixed(3)} / {coords.z.toFixed(3)}</div>
        <div>Block: {Math.floor(coords.x)} {Math.floor(coords.y)} {Math.floor(coords.z)}</div>
        <div>Chunk: {Math.floor(coords.x / 16)} {Math.floor(coords.z / 16)}</div>
      </div>
    </div>
  );
};
