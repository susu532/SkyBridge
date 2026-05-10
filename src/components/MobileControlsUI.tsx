import React, { useEffect, useRef, useState } from 'react';
import { useUI } from '../store/UIStore';
import { useGameStore } from '../store/gameStore';
import { Crosshair, ArrowUp, Zap, Anchor, Navigation, Hand } from 'lucide-react';

declare global {
  interface Window {
    mobileInputs: {
      joystickX: number;
      joystickY: number;
      isJumping: boolean;
      isCrouching: boolean;
      isAttacking: boolean;
      isInteracting: boolean;
      isZooming: boolean;
      triggerDrop: boolean;
      triggerPerspective: boolean;
      lookDeltaX: number;
      lookDeltaY: number;
    };
  }
}

window.mobileInputs = window.mobileInputs || {
  joystickX: 0,
  joystickY: 0,
  isJumping: false,
  isCrouching: false,
  isAttacking: false,
  isInteracting: false,
  isZooming: false,
  triggerDrop: false,
  triggerPerspective: false,
  lookDeltaX: 0,
  lookDeltaY: 0,
};

import { Menu, Backpack, MessageSquare, Camera, ScanEye, ArrowDownToLine } from 'lucide-react';

export const MobileControlsUI: React.FC = () => {
  const { isInventoryOpen, setInventoryOpen, isShopOpen, isSettingsOpen, isPauseMenuOpen, setPauseMenuOpen, isServerJoinOpen, isLaunchMenuOpen, isTyping, setTyping, setLocked } = useUI();
  const isAnyMenuOpen = isInventoryOpen || isShopOpen || isSettingsOpen || isPauseMenuOpen || isServerJoinOpen || isLaunchMenuOpen || isTyping;

  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const joystickTouchId = useRef<number | null>(null);
  const joystickCenter = useRef<{ x: number, y: number } | null>(null);

  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number, y: number } | null>(null);

  const maxRadius = useRef(50);

  useEffect(() => {
    const isTablet = window.innerWidth >= 768;
    maxRadius.current = isTablet ? 75 : 50;

    const handleResize = () => {
      maxRadius.current = window.innerWidth >= 768 ? 75 : 50;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (isAnyMenuOpen) return;
      
      // Prevent default to stop scrolling, specifically if they touch the canvas
      const target = e.target as HTMLElement;
      if (target.tagName === 'CANVAS' || target === document.body) {
        e.preventDefault();
      }
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        
        // Left side for joystick
        if (touch.clientX < window.innerWidth / 2 && joystickTouchId.current === null) {
          if (target && !target.closest('.mobile-button') && !target.closest('.pointer-events-auto')) {
            joystickTouchId.current = touch.identifier;
            joystickCenter.current = { x: touch.clientX, y: touch.clientY };
            
            if (baseRef.current && knobRef.current) {
              baseRef.current.style.display = 'block';
              baseRef.current.style.transform = `translate3d(${joystickCenter.current.x - maxRadius.current}px, ${joystickCenter.current.y - maxRadius.current}px, 0)`;
              baseRef.current.style.left = '0px';
              baseRef.current.style.top = '0px';
              baseRef.current.style.width = `${maxRadius.current * 2}px`;
              baseRef.current.style.height = `${maxRadius.current * 2}px`;

              knobRef.current.style.transform = `translate3d(${maxRadius.current}px, ${maxRadius.current}px, 0)`;
              knobRef.current.style.left = '-25px';
              knobRef.current.style.top = '-25px';
            }
          }
        } 
        // Right side for looking
        else if (touch.clientX >= window.innerWidth / 2 && lookTouchId.current === null) {
          // ensure it's not pressing a button
          if (target && !target.closest('.mobile-button') && !target.closest('.pointer-events-auto')) {
            lookTouchId.current = touch.identifier;
            lastLookPos.current = { x: touch.clientX, y: touch.clientY };
          }
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isAnyMenuOpen) return;
      e.preventDefault();
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        
        if (touch.identifier === joystickTouchId.current && joystickCenter.current) {
          const dx = touch.clientX - joystickCenter.current.x;
          const dy = touch.clientY - joystickCenter.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          let nx = dx;
          let ny = dy;
          if (distance > maxRadius.current) {
            nx = (dx / distance) * maxRadius.current;
            ny = (dy / distance) * maxRadius.current;
          }
          
          if (knobRef.current) {
            knobRef.current.style.transform = `translate3d(${maxRadius.current + nx}px, ${maxRadius.current + ny}px, 0)`;
          }

          window.mobileInputs.joystickX = nx / maxRadius.current;
          window.mobileInputs.joystickY = ny / maxRadius.current;
        } else if (touch.identifier === lookTouchId.current && lastLookPos.current) {
          const dx = touch.clientX - lastLookPos.current.x;
          const dy = touch.clientY - lastLookPos.current.y;
          
          // Scale look sensitivity based on screen size so users don't have to swipe as far to turn around
          const scale = window.innerWidth >= 768 ? 2.5 : 1.5;
          
          window.mobileInputs.lookDeltaX += dx * scale;
          window.mobileInputs.lookDeltaY += dy * scale;
          lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickTouchId.current) {
          joystickTouchId.current = null;
          joystickCenter.current = null;
          if (baseRef.current) {
            baseRef.current.style.display = 'none';
          }
          window.mobileInputs.joystickX = 0;
          window.mobileInputs.joystickY = 0;
        } else if (touch.identifier === lookTouchId.current) {
          lookTouchId.current = null;
          lastLookPos.current = null;
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isAnyMenuOpen]);

  // If a menu is open, don't show controls, but let hotbar clicks work? The hotbar is shown on bottom.
  if (isAnyMenuOpen) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden touch-none safe-pb">
      {/* Top HUD Buttons */}
      <div className="absolute top-2 right-2 md:top-4 md:right-4 flex gap-1.5 md:gap-4 pointer-events-auto safe-pr safe-pt transform scale-[0.85] sm:scale-100 origin-top-right landscape:scale-[0.8] sm:landscape:scale-100">
        <button 
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white  active:bg-white/40"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.triggerPerspective = true; }}
        >
          <Camera size={18} className="md:w-6 md:h-6" />
        </button>
        <button 
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white  active:bg-white/40"
          onClick={() => { setTyping(true); setLocked(false); }}
        >
          <MessageSquare size={18} className="md:w-6 md:h-6" />
        </button>
        <button 
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white  active:bg-white/40"
          onClick={() => { setInventoryOpen(true); setLocked(false); }}
        >
          <Backpack size={18} className="md:w-6 md:h-6" />
        </button>
        <button 
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white  active:bg-white/40"
          onClick={() => { setPauseMenuOpen(true); setLocked(false); }}
        >
          <Menu size={18} className="md:w-6 md:h-6" />
        </button>
      </div>

      {/* Target Crosshair */}
      <div className="absolute top-1/2 left-1/2 min-w-4 min-h-4 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-white/50">
        <Crosshair size={20} className="md:w-6 md:h-6" />
      </div>

      {/* Virtual Joystick */}
      <div 
        ref={baseRef}
        className="absolute rounded-full border-2 border-white/30 bg-black/20"
        style={{ display: 'none' }}
      >
        <div 
          ref={knobRef}
          className="absolute rounded-full bg-white/60 w-10 h-10 -ml-5 -mt-5"
        />
      </div>

      {/* Action Buttons (Right side - Diamond layout for thumbs) */}
      <div className="absolute bottom-2 right-2 md:bottom-12 md:right-12 pointer-events-none w-36 h-36 md:w-56 md:h-56 landscape:w-32 landscape:h-32 md:landscape:w-56 md:landscape:h-56 landscape:bottom-2 landscape:right-2 md:landscape:bottom-12 md:landscape:right-12 safe-mr safe-mb transform origin-bottom-right">
        {/* Zoom Button (Top Left) */}
        <button 
          className="absolute top-0 left-0 mobile-button w-10 h-10 md:w-16 md:h-16 landscape:w-8 landscape:h-8 md:landscape:w-16 md:landscape:h-16 rounded-full bg-white/20 border-[3px] border-white/40 flex items-center justify-center active:bg-white/40 opacity-80 pointer-events-auto shadow-md"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isZooming = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isZooming = false; }}
          onPointerLeave={() => window.mobileInputs.isZooming = false}
        >
          <ScanEye size={20} className="md:w-8 md:h-8 text-white drop-shadow-md" />
        </button>
        
        {/* Drop Button (Top Right) */}
        <button 
          className="absolute top-0 right-0 mobile-button w-10 h-10 md:w-16 md:h-16 landscape:w-8 landscape:h-8 md:landscape:w-16 md:landscape:h-16 rounded-full bg-red-500/20 border-[3px] border-red-500/40 flex items-center justify-center active:bg-red-500/40 opacity-80 pointer-events-auto shadow-md text-red-100"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.triggerDrop = true; }}
        >
          <ArrowDownToLine size={20} className="md:w-8 md:h-8 drop-shadow-md text-red-200" />
        </button>

        {/* Jump Button (Top) */}
        <button 
          className="absolute top-0 left-1/2 -translate-x-1/2 mobile-button w-12 h-12 md:w-20 md:h-20 landscape:w-10 landscape:h-10 md:landscape:w-20 md:landscape:h-20 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto  shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isJumping = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isJumping = false; }}
          onPointerLeave={() => window.mobileInputs.isJumping = false}
        >
          <ArrowUp size={24} className="md:w-10 md:h-10 text-white drop-shadow-md" />
        </button>
        
        {/* Interact Button (Left) */}
        <button 
          className="absolute top-1/2 left-0 -translate-y-1/2 mobile-button w-12 h-12 md:w-20 md:h-20 landscape:w-10 landscape:h-10 md:landscape:w-20 md:landscape:h-20 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto  shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isInteracting = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isInteracting = false; }}
          onPointerLeave={() => window.mobileInputs.isInteracting = false}
        >
          <Hand size={24} className="md:w-10 md:h-10 text-white drop-shadow-md" />
        </button>
        
        {/* Attack/Mine Button (Right) */}
        <button 
          className="absolute top-1/2 right-0 -translate-y-1/2 mobile-button w-14 h-14 md:w-24 md:h-24 landscape:w-12 landscape:h-12 md:landscape:w-24 md:landscape:h-24 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto  shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isAttacking = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isAttacking = false; }}
          onPointerLeave={() => window.mobileInputs.isAttacking = false}
        >
          <Zap size={28} className="md:w-12 md:h-12 text-white drop-shadow-md" />
        </button>

        {/* Crouch Button (Bottom) */}
        <button 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 mobile-button w-10 h-10 md:w-16 md:h-16 landscape:w-8 landscape:h-8 md:landscape:w-16 md:landscape:h-16 rounded-full bg-white/20 border-[3px] border-white/40 flex items-center justify-center active:bg-white/40 opacity-80 pointer-events-auto  shadow-md"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isCrouching = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isCrouching = false; }}
          onPointerLeave={() => window.mobileInputs.isCrouching = false}
        >
          <Anchor size={20} className="md:w-8 md:h-8 text-white drop-shadow-md" />
        </button>
      </div>
    </div>
  );
};
