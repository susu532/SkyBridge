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
  lookDeltaX: 0,
  lookDeltaY: 0,
};

import { Menu, Backpack, MessageSquare } from 'lucide-react';

export const MobileControlsUI: React.FC = () => {
  const { isInventoryOpen, setInventoryOpen, isShopOpen, isSettingsOpen, isPauseMenuOpen, setPauseMenuOpen, isServerJoinOpen, isLaunchMenuOpen, isTyping, setTyping, setLocked } = useUI();
  const isAnyMenuOpen = isInventoryOpen || isShopOpen || isSettingsOpen || isPauseMenuOpen || isServerJoinOpen || isLaunchMenuOpen || isTyping;

  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickCenter, setJoystickCenter] = useState<{ x: number, y: number } | null>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const joystickTouchId = useRef<number | null>(null);

  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number, y: number } | null>(null);

  const [maxRadius, setMaxRadius] = useState(50);

  useEffect(() => {
    const isTablet = window.innerWidth >= 768;
    setMaxRadius(isTablet ? 75 : 50);

    const handleResize = () => {
      setMaxRadius(window.innerWidth >= 768 ? 75 : 50);
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
            setJoystickCenter({ x: touch.clientX, y: touch.clientY });
            setJoystickPos({ x: 0, y: 0 });
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
        
        if (touch.identifier === joystickTouchId.current && joystickCenter) {
          const dx = touch.clientX - joystickCenter.x;
          const dy = touch.clientY - joystickCenter.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          let nx = dx;
          let ny = dy;
          if (distance > maxRadius) {
            nx = (dx / distance) * maxRadius;
            ny = (dy / distance) * maxRadius;
          }
          setJoystickPos({ x: nx, y: ny });
          window.mobileInputs.joystickX = nx / maxRadius;
          window.mobileInputs.joystickY = ny / maxRadius;
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
          setJoystickCenter(null);
          setJoystickPos({ x: 0, y: 0 });
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
  }, [joystickCenter, isAnyMenuOpen]);

  // If a menu is open, don't show controls, but let hotbar clicks work? The hotbar is shown on bottom.
  if (isAnyMenuOpen) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden touch-none safe-pb">
      {/* Top HUD Buttons */}
      <div className="absolute top-4 right-2 md:right-4 flex gap-2 md:gap-4 pointer-events-auto safe-pr safe-pt">
        <button 
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white backdrop-blur-md active:bg-white/40"
          onClick={() => { setTyping(true); setLocked(false); }}
        >
          <MessageSquare size={18} className="md:w-6 md:h-6" />
        </button>
        <button 
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white backdrop-blur-md active:bg-white/40"
          onClick={() => { setInventoryOpen(true); setLocked(false); }}
        >
          <Backpack size={18} className="md:w-6 md:h-6" />
        </button>
        <button 
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white backdrop-blur-md active:bg-white/40"
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
      {joystickCenter && (
        <div 
          className="absolute rounded-full border-2 border-white/30 bg-black/20"
          style={{
            left: joystickCenter.x - maxRadius,
            top: joystickCenter.y - maxRadius,
            width: maxRadius * 2,
            height: maxRadius * 2,
          }}
        >
          <div 
            className="absolute rounded-full bg-white/60 w-10 h-10 -ml-5 -mt-5"
            style={{
              left: maxRadius + joystickPos.x,
              top: maxRadius + joystickPos.y,
            }}
          />
        </div>
      )}

      {/* Action Buttons (Right side - Diamond layout for thumbs) */}
      <div className="absolute bottom-16 right-4 md:bottom-20 md:right-16 pointer-events-none w-48 h-48 md:w-64 md:h-64 safe-mr safe-mb">
        {/* Jump Button (Top) */}
        <button 
          className="absolute top-0 left-1/2 -translate-x-1/2 mobile-button w-14 h-14 md:w-20 md:h-20 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto backdrop-blur-md shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isJumping = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isJumping = false; }}
          onPointerLeave={() => window.mobileInputs.isJumping = false}
        >
          <ArrowUp size={28} className="md:w-10 md:h-10 text-white drop-shadow-md" />
        </button>
        
        {/* Interact Button (Left) */}
        <button 
          className="absolute top-1/2 left-0 -translate-y-1/2 mobile-button w-14 h-14 md:w-20 md:h-20 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto backdrop-blur-md shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isInteracting = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isInteracting = false; }}
          onPointerLeave={() => window.mobileInputs.isInteracting = false}
        >
          <Hand size={28} className="md:w-10 md:h-10 text-white drop-shadow-md" />
        </button>
        
        {/* Attack/Mine Button (Right) */}
        <button 
          className="absolute top-1/2 right-0 -translate-y-1/2 mobile-button w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto backdrop-blur-md shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isAttacking = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isAttacking = false; }}
          onPointerLeave={() => window.mobileInputs.isAttacking = false}
        >
          <Zap size={32} className="md:w-12 md:h-12 text-white drop-shadow-md" />
        </button>

        {/* Crouch Button (Bottom) */}
        <button 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 mobile-button w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/20 border-[3px] border-white/40 flex items-center justify-center active:bg-white/40 opacity-80 pointer-events-auto backdrop-blur-md shadow-md"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isCrouching = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isCrouching = false; }}
          onPointerLeave={() => window.mobileInputs.isCrouching = false}
        >
          <Anchor size={24} className="md:w-8 md:h-8 text-white drop-shadow-md" />
        </button>
      </div>
    </div>
  );
};
