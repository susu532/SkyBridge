import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

export const BattleRoyaleSidebar: React.FC = () => {
  const [playersAlive, setPlayersAlive] = useState(100);
  const serverId = useGameStore(state => state.serverId);
  const dateStr = new Date().toLocaleDateString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit' });
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Simulate players dying over time in a completely un-tied way
    const interval = setInterval(() => {
       setPlayersAlive(prev => Math.max(1, prev - Math.floor(Math.random() * 3)));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let animationId: number;
    const loop = () => {
      if ((window as any).game && (window as any).game.player) {
         setPlayerPos(prev => {
            const nx = (window as any).game.player.position.x;
            const nz = (window as any).game.player.position.z;
            if (prev.x === nx && prev.z === nz) return prev;
            return { x: nx, z: nz };
         });
      }
      animationId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Map bounds: -400 to +400
    const mapSize = 800;
    const scale = canvas.width / mapSize;

    // Draw background (water/ocean boundary)
    ctx.fillStyle = '#06b6d4'; // cyan ocean
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw island base
    ctx.fillStyle = '#78716c'; // stone base
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, 400 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Helper for deterministic randomness
    const hashVec = (x: number, y: number, z: number): number => {
        return Math.abs(x * 73856093 ^ z * 19349663 ^ y * 83492791);
    };

    const gridSpacing = 100;
    const halfRoad = 8;
    const sidewalkWidth = 4;

    // Draw City Blocks
    ctx.fillStyle = '#334155'; // concrete gray
    ctx.fill(); // fill everything with concrete first within island

    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, 400 * scale, 0, Math.PI * 2);
    ctx.clip(); // Clip to circular island

    ctx.fillStyle = '#475569'; // general concrete color
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let x = -400; x <= 400; x += gridSpacing) {
         for (let z = -400; z <= 400; z += gridSpacing) {
             const gridX = Math.floor(x / gridSpacing);
             const gridZ = Math.floor(z / gridSpacing);
             
             // Draw Plot
             const isHospital = 
                 (gridX === -2 && gridZ === -2) || 
                 (gridX === 2 && gridZ === -1) || 
                 (gridX === 0 && gridZ === 3);

             const plotHash = hashVec(gridX, 0, gridZ) % 100;
             let plotType = 'PARK';
             if (isHospital) {
                 plotType = 'HOSPITAL';
             } else {
                 plotType = plotHash < 20 ? 'PARK' : 
                            plotHash < 45 ? 'SKYSCRAPER' : 
                            plotHash < 70 ? 'APARTMENT' : 
                            plotHash < 85 ? 'WAREHOUSE' : 
                            plotHash < 93 ? 'MALL' : 'LIBRARY';
             }

             const screenX = (gridX * gridSpacing + 400) * scale;
             const screenZ = (gridZ * gridSpacing + 400) * scale;
             const plotSize = gridSpacing * scale;
             
             // Center of intersection offset
             const offset = gridSpacing / 2;

             // Fill Plot Area
             if (plotType === 'PARK') {
                 ctx.fillStyle = '#22c55e'; // grass green
                 ctx.fillRect(screenX, screenZ, plotSize, plotSize);
                 
                 // Render pond
                 ctx.fillStyle = '#3b82f6';
                 ctx.beginPath();
                 ctx.arc(screenX + plotSize/2, screenZ + plotSize/2, 16 * scale, 0, Math.PI*2);
                 ctx.fill();
             } else if (plotType === 'SKYSCRAPER') {
                 ctx.fillStyle = '#94a3b8'; // light stone
                 ctx.fillRect(screenX + (offset-25)*scale, screenZ + (offset-25)*scale, 50*scale, 50*scale);
             } else if (plotType === 'APARTMENT') {
                 ctx.fillStyle = '#f43f5e'; // brick red
                 ctx.fillRect(screenX + (offset-20)*scale, screenZ + (offset-15)*scale, 40*scale, 30*scale);
             } else if (plotType === 'WAREHOUSE') {
                 ctx.fillStyle = '#a8a29e'; // light gray
                 ctx.fillRect(screenX + (offset-35)*scale, screenZ + (offset-20)*scale, 70*scale, 40*scale);
             } else if (plotType === 'MALL') {
                 ctx.fillStyle = '#7dd3fc'; // glass
                 ctx.beginPath();
                 ctx.arc(screenX + offset*scale, screenZ + offset*scale, 38 * scale, 0, Math.PI*2);
                 ctx.fill();
             } else if (plotType === 'LIBRARY') {
                 ctx.fillStyle = '#fef08a'; // pale yellow
                 ctx.fillRect(screenX + (offset-20)*scale, screenZ + (offset-20)*scale, 40*scale, 40*scale);
             } else if (plotType === 'HOSPITAL') {
                 ctx.fillStyle = '#f8fafc'; // white
                 ctx.fillRect(screenX + (offset-30)*scale, screenZ + (offset-20)*scale, 60*scale, 40*scale);
                 ctx.fillStyle = '#dc2626'; // red cross
                 ctx.fillRect(screenX + (offset-5)*scale, screenZ + (offset-15)*scale, 10*scale, 30*scale);
                 ctx.fillRect(screenX + (offset-15)*scale, screenZ + (offset-5)*scale, 30*scale, 10*scale);
             }
         }
    }

    // Draw Roads (Grid Lines overlapping)
    ctx.fillStyle = '#1e293b'; // dark asphalt road
    for (let i = -400; i <= 400; i += gridSpacing) {
         // Vertical Roads
         const sx = (i + 400 - halfRoad) * scale;
         ctx.fillRect(sx, 0, halfRoad * 2 * scale, canvas.height);
         // Horizontal Roads
         const sz = (i + 400 - halfRoad) * scale;
         ctx.fillRect(0, sz, canvas.width, halfRoad * 2 * scale);
    }
    
    ctx.restore(); // restore clip

    // Draw safe zone indicator
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 400 * scale - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Draw player
    const px = (playerPos.x + 400) * scale;
    const pz = (playerPos.z + 400) * scale;

    ctx.fillStyle = '#10b981'; // green for player
    ctx.beginPath();
    ctx.arc(px, pz, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText('You', px - 8, pz - 8);

  }, [playerPos]);


  return (
    <div className="absolute right-0 md:right-4 landscape:right-0 xl:landscape:right-4 top-0 md:top-32 landscape:top-0 xl:landscape:top-24 flex flex-col gap-2 pointer-events-none mc-font transform scale-[0.35] sm:scale-75 xl:scale-100 origin-top-right safe-pr safe-pt landscape:scale-[0.35] md:landscape:scale-[0.65] xl:landscape:scale-100 pb-2">
      
      {/* Sidebar Container */}
      <div className="bg-black/60  p-3 md:p-4 border-l-4 border-[#FFAA00] text-white text-sm md:text-base shadow-2xl min-w-[160px] md:min-w-[200px]">
        <div className="text-[#FFAA00] font-bold mb-1 text-center uppercase tracking-[0.1em] text-lg mc-text-shadow">BATTLE ROYALE</div>
        <div className="text-white/60 text-xs text-center mb-3 border-b border-white/10 pb-2 mc-text-shadow">{dateStr} <span className="text-[#55FF55]">{serverId || 'm123'}</span></div>
        
        <div className="space-y-4">
          <div className="flex flex-col">
             <span className="text-white text-sm mc-text-shadow">Players Alive:</span>
             <span className="text-[#55FFFF] font-bold text-3xl mc-text-shadow">{playersAlive}</span>
          </div>

          <div className="flex flex-col border-t border-white/10 pt-2 mt-2">
            <span className="text-[#FFAA00] text-sm mc-text-shadow font-bold">Kills: 0</span>
          </div>

          <div className="flex flex-col border-t border-white/10 pt-2 mt-2">
            <span className="text-gray-300 text-sm mc-text-shadow overflow-hidden whitespace-nowrap overflow-ellipsis">Zone shrinking in...</span>
            <span className="text-white font-bold mc-text-shadow">02:35</span>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-[#FFAA00] font-bold tracking-tighter opacity-50 mc-text-shadow">
          STARPLEX.IO
        </div>
      </div>

      {/* Minimap Box */}
      <div className="bg-black/80  p-2 border-2 border-white/20 rounded shadow-2xl mt-2 flex flex-col items-center">
        <canvas ref={canvasRef} width={150} height={150} className="rounded" />
        <span className="text-white/80 text-xs mt-1 font-bold">MINIMAP</span>
      </div>
    </div>
  );
};
