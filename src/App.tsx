/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useGameEngine } from './hooks/useGameEngine';
import { GameHUD } from './components/GameHUD';
import { GameMenus } from './components/GameMenus';
import { MapLoadingScreen } from './components/MapLoadingScreen';
import { StatsPanel } from './components/StatsPanel';
import { useUI } from './store/UIStore';

export default function App() {
  const {
    canvasRef,
    game,
    isMobile,
    isUnderwater,
    isUnderLava,
    targetServer,
    targetInfo,
    showDebug,
    handleStart,
    setGameKey
  } = useGameEngine();

  const { setPauseMenuOpen } = useUI();

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-black font-sans cursor-crosshair"
      onPointerDown={handleStart}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* Vignette Effect */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_50%,rgba(0,0,0,0.4)_100%)]" />

      {/* Underwater Overlay */}
      {isUnderwater && !isUnderLava && (
        <div className="absolute inset-0 pointer-events-none bg-blue-600/30 md:backdrop-blur-[2px] animate-pulse" />
      )}

      {/* Lava Overlay */}
      {isUnderLava && (
        <>
          <div className="absolute inset-0 pointer-events-none bg-orange-600/60 md:backdrop-blur-[4px] animate-pulse" />
          <div className="absolute inset-0 pointer-events-none bg-red-900/40" />
        </>
      )}

      <GameHUD 
        game={game} 
        isMobile={isMobile} 
        showDebug={showDebug} 
        targetInfo={targetInfo} 
        handleStart={handleStart} 
        setPauseMenuOpen={setPauseMenuOpen} 
      />

      <GameMenus 
        game={game} 
        targetServer={targetServer} 
        handleStart={handleStart} 
        setGameKey={setGameKey} 
      />

      {/* Map Loading Screen */}
      <MapLoadingScreen />

      <StatsPanel />

      {/* Force Landscape Overlay for Mobile */}
      {isMobile && (
        <div className="hidden portrait:flex fixed inset-0 z-[99999] bg-zinc-950 text-white flex-col items-center justify-center text-center p-8 select-none touch-none">
          <div className="w-16 h-28 border-4 border-zinc-500 rounded-xl flex items-center justify-center mb-8 relative">
             <div className="w-8 h-1 bg-zinc-500 rounded-full mt-auto mb-2"></div>
             <div className="absolute inset-0 flex items-center justify-center rotate-90 opacity-50">
               <div className="w-28 h-16 border-4 border-white rounded-xl flex items-center justify-center absolute">
                 <div className="w-1 h-8 bg-white rounded-full ml-auto mr-2"></div>
               </div>
             </div>
          </div>
          <h2 className="text-3xl font-bold mb-3 font-sans tracking-tight text-white">Tap Screen</h2>
          <p className="text-zinc-400 text-lg max-w-[280px] mx-auto leading-relaxed">
            Please rotate your device to landscape mode to play.
          </p>
        </div>
      )}
    </div>
  );
}
