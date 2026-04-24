
import React, { useEffect, useRef } from 'react';
import { networkManager } from '../game/NetworkManager';

export const DamageNumbers: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDamage = (e: any) => {
      if (!containerRef.current) return;
      const { amount, isCrit } = e.detail;
      
      const x = window.innerWidth / 2 + (Math.random() - 0.5) * 100;
      const y = window.innerHeight / 2 + (Math.random() - 0.5) * 100;
      
      const el = document.createElement('div');
      el.className = `absolute font-bold text-2xl drop-shadow-[2px_2px_0_rgba(0,0,0,1)] pointer-events-none transition-all duration-1000 ease-out z-[1000] ${isCrit ? 'text-[#FFFF55]' : 'text-white'}`;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.opacity = '1';
      el.style.transform = `translate(-50%, -50%) scale(${isCrit ? 1.5 : 1})`;
      
      el.innerText = isCrit ? `✧ ${amount} ✧` : `${amount}`;
      
      containerRef.current.appendChild(el);
      
      // Animate up
      requestAnimationFrame(() => {
        el.style.top = `${y - 120}px`;
        el.style.opacity = '0';
      });
      
      setTimeout(() => {
        el.remove();
      }, 1000);
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

