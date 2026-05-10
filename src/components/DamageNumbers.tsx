
import React, { useEffect, useRef } from 'react';
import { networkManager } from '../game/NetworkManager';

export const DamageNumbers: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderDamageNumber = (amount: number, isCrit: boolean, screenX?: number, screenY?: number) => {
      if (!containerRef.current) return;
      
      const baseX = screenX !== undefined ? screenX : window.innerWidth / 2;
      const baseY = screenY !== undefined ? screenY : window.innerHeight / 2;
      
      // Add slight randomness so stacked numbers spread out
      const rx = (Math.random() - 0.5) * 40;
      const ry = (Math.random() - 0.5) * 40;
      const x = baseX + rx;
      const y = baseY + ry;
      
      const el = document.createElement('div');
      el.className = `absolute font-bold text-2xl drop-shadow-[2px_2px_0_rgba(0,0,0,1)] pointer-events-none transition-all duration-1000 ease-out z-[1000] ${isCrit ? 'text-[#FFFF55]' : 'text-white'}`;
      el.style.left = '0';
      el.style.top = '0';
      el.style.opacity = '1';
      // translate3d uses hardware acceleration
      el.style.transform = `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), 0) scale(${isCrit ? 1.5 : 1})`;
      
      el.innerText = isCrit ? `✧ ${amount} ✧` : `${amount}`;
      
      containerRef.current.appendChild(el);
      
      // Animate up
      requestAnimationFrame(() => {
        el.style.transform = `translate3d(calc(${x}px - 50%), calc(${y - 100}px - 50%), 0) scale(${isCrit ? 1.5 : 1})`;
        el.style.opacity = '0';
      });
      
      setTimeout(() => {
        el.remove();
      }, 1000);
    };

    const handleDamage = (e: any) => {
      const { amount, isCrit, screenX, screenY } = e.detail;
      renderDamageNumber(amount, isCrit, screenX, screenY);
    };

    // For network attacks
    const handleNetworkPlayerHit = (e: any) => {
      // Don't duplicate for our own attacks which we've already predicted locally
      if (e.detail.attackerId && e.detail.attackerId === networkManager.id) return;
      
      // Render damage if we have projected coords (from EntityManager if we project it there, 
      // but if we don't, we can just let Game handle it. Wait, the event doesn't have screen coordinates!)
      // Instead, we just dispatch mobDamage from the network hit handlers in EntityManager!
    };

    window.addEventListener('mobDamage', handleDamage as EventListener);
    return () => {
      window.removeEventListener('mobDamage', handleDamage as EventListener);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[1000] overflow-hidden" />
  );
};


