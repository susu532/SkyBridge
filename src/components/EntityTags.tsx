import React, { useEffect, useRef } from 'react';
import { Game } from '../game/Game';
import { MobType } from '../game/Mob';

interface MobTagProps {
  game: Game | null;
}

export const EntityTags: React.FC<MobTagProps> = ({ game }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!game) return;

    let frameId: number;
    const updateTags = () => {
      const entityTags = game.getEntityTags();
      const container = containerRef.current;
      
      if (container) {
        // Keep track of which IDs we've seen this frame
        const currentIds = new Set<string>();

        for (let i = 0; i < entityTags.length; i++) {
          const tag = entityTags[i];
          currentIds.add(tag.id);
          
          let el = document.getElementById(`entity-tag-${tag.id}`);
          
          // Create element if it doesn't exist
          if (!el) {
            el = document.createElement('div');
            el.id = `entity-tag-${tag.id}`;
            el.className = "absolute flex flex-col items-center justify-center transform origin-bottom";
            el.style.top = "0";
            el.style.left = "0";
            
            const innerDiv = document.createElement('div');
            const isPlayer = tag.type === 'Player';
            innerDiv.className = `px-1.5 py-0.5 md:px-3 md:py-1 rounded border flex items-center gap-1 md:gap-2 whitespace-nowrap mc-font text-[10px] md:text-[16px] shadow-lg ${isPlayer ? 'bg-black/40 border-white/10' : 'bg-black/70 border-white/20'}`;
            
            if (!tag.isPassive && !isPlayer && tag.type !== 'Morvane') {
              const lvSpan = document.createElement('span');
              lvSpan.className = "text-[#FFFF55] font-bold text-[12px] md:text-[18px]";
              lvSpan.innerText = `Lv${tag.level}`;
              innerDiv.appendChild(lvSpan);
            }
            if (isPlayer && tag.team) {
              const teamSpan = document.createElement('span');
              teamSpan.className = tag.team === 'red' ? "text-[#FF5555] font-bold" : "text-[#5555FF] font-bold";
              teamSpan.innerText = `[${tag.team.toUpperCase()}]`;
              innerDiv.appendChild(teamSpan);
            }
            
            const nameSpan = document.createElement('span');
            let nameColor = "text-white";
            if (isPlayer && tag.team) {
              if (tag.team === 'red') nameColor = "text-[#FF5555]";
              else if (tag.team === 'blue') nameColor = "text-[#5555FF]";
            }
            nameSpan.className = `${nameColor} font-medium`;
            nameSpan.innerText = isPlayer ? tag.name : tag.type;
            innerDiv.appendChild(nameSpan);
            
            if (!isPlayer) {
              const hpSpan = document.createElement('span');
              hpSpan.className = `font-bold ${tag.isPassive ? 'text-[#55FF55]' : 'text-[#FF5555]'}`;
              hpSpan.id = `entity-hp-${tag.id}`;
              hpSpan.innerText = `${Math.ceil(tag.health)}❤`;
              innerDiv.appendChild(hpSpan);
            }
            
            el.appendChild(innerDiv);
            container.appendChild(el);
          } else {
            // Update health if it changed
            const isPlayer = tag.type === 'Player';
            if (!isPlayer) {
              const hpSpan = document.getElementById(`entity-hp-${tag.id}`);
              if (hpSpan) {
                const newHpText = `${Math.ceil(tag.health)}❤`;
                if (hpSpan.innerText !== newHpText) {
                  hpSpan.innerText = newHpText;
                }
              }
            }
          }

          const distance = isFinite(tag.distance) ? tag.distance : 0;
          const scale = Math.max(0.4, 1 - distance / 50);
          const opacity = Math.max(0, 1 - distance / 40);
          const left = isFinite(tag.x) ? tag.x : -1000;
          const top = isFinite(tag.y) ? tag.y : -1000;

          // Use transform translate3d instead of left/top to avoid layout thrashing
          el.style.opacity = isFinite(opacity) ? opacity.toString() : '0';
          el.style.transform = `translate3d(calc(${left}px - 50%), calc(${top}px - 100%), 0) scale(${isFinite(scale) ? scale : 0})`;
        }

        // Remove elements that are no longer in entityTags
        Array.from(container.children).forEach((child) => {
          const el = child as HTMLElement;
          const id = el.id.replace('entity-tag-', '');
          if (!currentIds.has(id)) {
            el.remove();
          }
        });
      }

      frameId = requestAnimationFrame(updateTags);
    };

    frameId = requestAnimationFrame(updateTags);

    return () => cancelAnimationFrame(frameId);
  }, [game]);

  if (!game) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden" />
  );
};
