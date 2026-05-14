import { useGameStore } from '../store/gameStore';

export function EnvironmentOverlays() {
  const isUnderwater = useGameStore(state => state.isUnderwater);
  const isUnderLava = useGameStore(state => state.isUnderLava);

  return (
    <>
      {/* Underwater Overlay */}
      {isUnderwater && !isUnderLava && (
        <div className="absolute inset-0 pointer-events-none bg-blue-600/30 md:backdrop-blur-[2px] animate-pulse z-[10]" />
      )}

      {/* Lava Overlay */}
      {isUnderLava && (
        <>
          <div className="absolute inset-0 pointer-events-none bg-orange-600/60 md:backdrop-blur-[4px] animate-pulse z-[10]" />
          <div className="absolute inset-0 pointer-events-none bg-red-900/40 z-[10]" />
        </>
      )}
    </>
  );
}
