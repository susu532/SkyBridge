import React, { useEffect, useState, useRef } from 'react';
import { Game } from '../game/Game';
import { MobType } from '../game/Mob';

interface MobTagProps {
  game: Game | null;
}

export const EntityTags: React.FC<MobTagProps> = ({ game }) => {
  const [tagsData, setTagsData] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef<any[]>([]);

  useEffect(() => {
    if (!game) return;

    let frameId: number;
    const updateTags = () => {
      const entityTags = game.getEntityTags();
      
      let needsRender = false;
      if (entityTags.length !== lastUpdateRef.current.length) {
        needsRender = true;
      } else {
        for (let i = 0; i < entityTags.length; i++) {
          const current = entityTags[i];
          const prev = lastUpdateRef.current[i];
          if (current.id !== prev.id || current.health !== prev.health || current.level !== prev.level || current.name !== prev.name) {
            needsRender = true;
            break;
          }
        }
      }

      if (needsRender) {
        setTagsData(entityTags.map(t => ({ ...t })));
      }

      if (containerRef.current) {
        for (let i = 0; i < entityTags.length; i++) {
          const tag = entityTags[i];
          const el = document.getElementById(`entity-tag-${tag.id}`);
          if (el) {
            const distance = isFinite(tag.distance) ? tag.distance : 0;
            const scale = Math.max(0.4, 1 - distance / 50);
            const opacity = Math.max(0, 1 - distance / 40);
            const left = isFinite(tag.x) ? tag.x : -1000;
            const top = isFinite(tag.y) ? tag.y : -1000;

            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
            el.style.opacity = isFinite(opacity) ? opacity.toString() : '0';
            el.style.transform = `translate(-50%, -100%) scale(${isFinite(scale) ? scale : 0})`;
          }
        }
      }

      lastUpdateRef.current = entityTags;
      frameId = requestAnimationFrame(updateTags);
    };

    frameId = requestAnimationFrame(updateTags);

    return () => cancelAnimationFrame(frameId);
  }, [game]);

  if (!game) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden">
      {tagsData.map((tag) => {
        const isPlayer = tag.type === 'Player';

        return (
          <div
            id={`entity-tag-${tag.id}`}
            key={tag.id}
            className="absolute flex flex-col items-center justify-center transform origin-bottom"
            style={{
              left: -1000,
              top: -1000,
              opacity: 0,
              transform: 'translate(-50%, -100%) scale(0)'
            }}
          >
            <div className={`px-3 py-1 rounded border flex items-center gap-2 whitespace-nowrap mc-font text-[16px] shadow-lg ${isPlayer ? 'bg-black/40 border-white/10' : 'bg-black/70 border-white/20'}`}>
              {!tag.isPassive && !isPlayer && (
                <span className="text-[#FFFF55] font-bold text-[18px]">Lv{tag.level}</span>
              )}
              {isPlayer && (
                <span className="text-[#55FFFF] font-bold">Lv{tag.level}</span>
              )}
              <span className="text-white font-medium">{isPlayer ? tag.name : tag.type}</span>
              {!isPlayer && (
                <span className={`font-bold ${tag.isPassive ? 'text-[#55FF55]' : 'text-[#FF5555]'}`}>
                  {Math.ceil(tag.health)}❤
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
