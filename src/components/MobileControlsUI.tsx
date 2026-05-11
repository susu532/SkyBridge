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
      isSprinting: boolean;
      isZooming: boolean;
      triggerDrop: boolean;
      triggerPerspective: boolean;
      triggerTap: boolean;
      lookDeltaX: number;
      lookDeltaY: number;
      zoomJoystickX: number;
      zoomJoystickY: number;
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
  isSprinting: false,
  isZooming: false,
  triggerDrop: false,
  triggerPerspective: false,
  triggerTap: false,
  lookDeltaX: 0,
  lookDeltaY: 0,
  zoomJoystickX: 0,
  zoomJoystickY: 0,
};

import { Menu, Backpack, MessageSquare, Camera, ScanEye, ArrowDownToLine, Sword, ArrowDown, ChevronsUp } from 'lucide-react';

export const MobileControlsUI: React.FC = () => {
  const { isInventoryOpen, setInventoryOpen, isShopOpen, isSettingsOpen, isPauseMenuOpen, setPauseMenuOpen, isServerJoinOpen, isLaunchMenuOpen, isTyping, setTyping, setLocked } = useUI();
  const isAnyMenuOpen = isInventoryOpen || isShopOpen || isSettingsOpen || isPauseMenuOpen || isServerJoinOpen || isLaunchMenuOpen || isTyping;

  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const joystickTouchId = useRef<number | null>(null);
  const joystickCenter = useRef<{ x: number, y: number } | null>(null);

  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number, y: number } | null>(null);
  
  const lastZoomLookPos = useRef<{ x: number, y: number } | null>(null);

  const maxRadius = useRef(50);
  
  const activeTaps = useRef<Map<number, { x: number, y: number, time: number, isSwipe: boolean, holdTimeout: any, isHolding: boolean }>>(new Map());

  const [dpad, setDpad] = useState({ x: 0, y: 0 });
  const dpadRef = useRef<HTMLDivElement>(null);
  const dpadPointerId = useRef<number | null>(null);

  const startDpad = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dpadPointerId.current !== null) return;
    dpadPointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateDpad(e);
  };

  const updateDpad = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dpadPointerId.current !== e.pointerId || !dpadRef.current) return;
    const rect = dpadRef.current.getBoundingClientRect();
    
    let x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    let y = ((e.clientY - rect.top) / rect.height) * 2 - 1;

    const deadzone = 0.25;
    
    let newX = 0;
    let newY = 0;

    if (x < -deadzone) newX = -1;
    else if (x > deadzone) newX = 1;

    if (y < -deadzone) newY = -1;
    else if (y > deadzone) newY = 1;

    window.mobileInputs.joystickX = newX;
    window.mobileInputs.joystickY = newY;
    
    setDpad(prev => (prev.x !== newX || prev.y !== newY) ? { x: newX, y: newY } : prev);
  };

  const stopDpad = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dpadPointerId.current !== e.pointerId) return;
    dpadPointerId.current = null;
    window.mobileInputs.joystickX = 0;
    window.mobileInputs.joystickY = 0;
    setDpad({ x: 0, y: 0 });
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

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
        let handled = false;
        
        // Left side for joystick
        if (touch.clientX < window.innerWidth / 2 && joystickTouchId.current === null) {
          if (target && !target.closest('.mobile-button') && !target.closest('.pointer-events-auto')) {
            // D-Pad handles movement directly, we only need to catch stray touches to prevent screen look from left side
            handled = false;
          }
        } 
        // Right side for looking
        else if (touch.clientX >= window.innerWidth / 2 && lookTouchId.current === null) {
          // ensure it's not pressing a button
          if (target && !target.closest('.mobile-button') && !target.closest('.pointer-events-auto')) {
            handled = true;
            lookTouchId.current = touch.identifier;
            lastLookPos.current = { x: touch.clientX, y: touch.clientY };
          }
        }

        if (handled) {
            const holdTimeout = setTimeout(() => {
                const tap = activeTaps.current.get(touch.identifier);
                if (tap && !tap.isSwipe) {
                    window.mobileInputs.isAttacking = true;
                    tap.isHolding = true;
                }
            }, 300);

            activeTaps.current.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now(),
                isSwipe: false,
                holdTimeout,
                isHolding: false
            });
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isAnyMenuOpen) return;
      e.preventDefault();
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        
        const tap = activeTaps.current.get(touch.identifier);
        if (tap) {
            const dx = touch.clientX - tap.x;
            const dy = touch.clientY - tap.y;
            if (dx*dx + dy*dy > 100) {
                tap.isSwipe = true;
                if (!tap.isHolding) {
                   clearTimeout(tap.holdTimeout);
                } else if (touch.identifier === joystickTouchId.current) {
                   // Only cancel mining if they swiped on the joystick side
                   tap.isHolding = false;
                   let anyHolding = false;
                   activeTaps.current.forEach(t => { if (t.isHolding) anyHolding = true; });
                   if (!anyHolding) {
                       window.mobileInputs.isAttacking = false;
                   }
                }
            }
        }

        if (touch.identifier === lookTouchId.current && lastLookPos.current) {
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
        
        const tap = activeTaps.current.get(touch.identifier);
        if (tap) {
            clearTimeout(tap.holdTimeout);
            const holdTime = Date.now() - tap.time;
            
            if (!tap.isSwipe && !tap.isHolding && holdTime < 300) {
                window.mobileInputs.triggerTap = true;
            }
            
            activeTaps.current.delete(touch.identifier);
        }

        if (touch.identifier === lookTouchId.current) {
          lookTouchId.current = null;
          lastLookPos.current = null;
        }
      }
      
      let anyHolding = false;
      activeTaps.current.forEach(t => { if (t.isHolding) anyHolding = true; });
      if (!anyHolding) {
          window.mobileInputs.isAttacking = false;
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
      <div className="absolute top-2 right-2 flex gap-2 pointer-events-auto safe-pr safe-pt transform origin-top-right scale-[0.8] landscape:scale-[0.6] landscape:top-1 landscape:right-1">
        <button 
          className="w-12 h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:bg-white/40 touch-none mobile-button"
          onPointerDown={(e) => { 
            e.preventDefault(); 
            window.mobileInputs.isZooming = true;
            lastZoomLookPos.current = { x: e.clientX, y: e.clientY };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (window.mobileInputs.isZooming && lastZoomLookPos.current) {
              const dx = e.clientX - lastZoomLookPos.current.x;
              const dy = e.clientY - lastZoomLookPos.current.y;
              const maxDist = 40;
              window.mobileInputs.zoomJoystickX = Math.max(-1, Math.min(1, dx / maxDist));
              window.mobileInputs.zoomJoystickY = Math.max(-1, Math.min(1, dy / maxDist));
            }
          }}
          onPointerUp={(e) => { 
            e.preventDefault(); 
            window.mobileInputs.isZooming = false;
            window.mobileInputs.zoomJoystickX = 0;
            window.mobileInputs.zoomJoystickY = 0;
            lastZoomLookPos.current = null;
            (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
          }}
          onPointerCancel={() => { 
            window.mobileInputs.isZooming = false;
            window.mobileInputs.zoomJoystickX = 0;
            window.mobileInputs.zoomJoystickY = 0;
            lastZoomLookPos.current = null;
          }}
        >
          <ScanEye size={20} className="text-white drop-shadow-md" />
        </button>
        <button 
          className="w-12 h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:bg-white/40"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.triggerPerspective = true; }}
        >
          <Camera size={20} />
        </button>
        <button 
          className="w-12 h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:bg-white/40"
          onClick={() => { setTyping(true); setLocked(false); }}
        >
          <MessageSquare size={20} />
        </button>
        <button 
          className="w-12 h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:bg-white/40"
          onClick={() => { setInventoryOpen(true); setLocked(false); }}
        >
          <Backpack size={20} />
        </button>
        <button 
          className="w-12 h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:bg-white/40"
          onClick={() => { setPauseMenuOpen(true); setLocked(false); }}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Target Crosshair */}
      <div className="absolute top-1/2 left-1/2 min-w-4 min-h-4 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-white/50">
        <Crosshair size={24} />
      </div>

      {/* D-Pad Container (Left side) */}
      <div 
        ref={dpadRef}
        className="absolute bottom-4 left-4 w-36 h-36 landscape:w-32 landscape:h-32 landscape:bottom-2 landscape:left-2 safe-ml safe-mb z-50 pointer-events-auto touch-none"
        onPointerDown={startDpad}
        onPointerMove={updateDpad}
        onPointerUp={stopDpad}
        onPointerCancel={stopDpad}
      >
        {/* Forward */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-12 h-16 landscape:w-12 landscape:h-12 border-[3px] border-white/50 rounded flex justify-center items-center shadow-lg transition-colors ${dpad.y === -1 ? 'bg-white/40' : 'bg-white/20'}`}>
          <ArrowUp size={24} className="text-white drop-shadow-md" />
        </div>
        {/* Backward */}
        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-16 landscape:w-12 landscape:h-12 border-[3px] border-white/50 rounded flex justify-center items-center shadow-lg transition-colors ${dpad.y === 1 ? 'bg-white/40' : 'bg-white/20'}`}>
          <ArrowUp size={24} className="text-white drop-shadow-md rotate-180" />
        </div>
        {/* Left */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-16 h-12 landscape:w-12 landscape:h-12 border-[3px] border-white/50 rounded flex justify-center items-center shadow-lg transition-colors ${dpad.x === -1 ? 'bg-white/40' : 'bg-white/20'}`}>
          <ArrowUp size={24} className="text-white drop-shadow-md -rotate-90" />
        </div>
        {/* Right */}
        <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-16 h-12 landscape:w-12 landscape:h-12 border-[3px] border-white/50 rounded flex justify-center items-center shadow-lg transition-colors ${dpad.x === 1 ? 'bg-white/40' : 'bg-white/20'}`}>
          <ArrowUp size={24} className="text-white drop-shadow-md rotate-90" />
        </div>
      </div>

      {/* Action Buttons (Right side - Diamond layout for thumbs) */}
      <div className="absolute bottom-4 right-4 pointer-events-none w-44 h-44 landscape:w-36 landscape:h-36 landscape:bottom-2 landscape:right-2 safe-mr safe-mb transform origin-bottom-right scale-[0.75] sm:scale-100 landscape:scale-[0.65] md:landscape:scale-100">
        {/* Drop Button (Top Right) */}
        <button 
          className="absolute top-0 right-0 mobile-button w-12 h-12 landscape:w-10 landscape:h-10 rounded-full bg-red-500/20 border-[3px] border-red-500/40 flex items-center justify-center active:bg-red-500/40 opacity-80 pointer-events-auto shadow-md text-red-100"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.triggerDrop = true; }}
        >
          <ArrowDownToLine size={20} className="drop-shadow-md text-red-200" />
        </button>

        {/* Jump Button (Top) */}
        <button 
          className="absolute top-0 left-1/2 -translate-x-1/2 mobile-button w-14 h-14 landscape:w-12 landscape:h-12 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isJumping = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isJumping = false; }}
          onPointerLeave={() => window.mobileInputs.isJumping = false}
        >
          <ArrowUp size={24} className="text-white drop-shadow-md" />
        </button>
        
        {/* Sprint Button (Top Right corner) */}
        <button 
          className="absolute -top-4 -right-2 mobile-button w-12 h-12 landscape:w-10 landscape:h-10 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isSprinting = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isSprinting = false; }}
          onPointerLeave={() => window.mobileInputs.isSprinting = false}
        >
          <ChevronsUp size={20} className="text-white drop-shadow-md" />
        </button>

        {/* Interact Button (Left) */}
        <button 
          className="absolute top-1/2 left-0 -translate-y-1/2 mobile-button w-14 h-14 landscape:w-12 landscape:h-12 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isInteracting = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isInteracting = false; }}
          onPointerLeave={() => window.mobileInputs.isInteracting = false}
        >
          <Hand size={24} className="text-white drop-shadow-md" />
        </button>
        
        {/* Attack/Mine Button (Right) */}
        <button 
          className="absolute top-1/2 right-0 -translate-y-1/2 mobile-button w-16 h-16 landscape:w-14 landscape:h-14 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isAttacking = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isAttacking = false; }}
          onPointerLeave={() => window.mobileInputs.isAttacking = false}
        >
          <Sword size={28} className="text-white drop-shadow-md" />
        </button>

        {/* Crouch Button (Bottom) */}
        <button 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 mobile-button w-12 h-12 landscape:w-10 landscape:h-10 rounded-full bg-white/20 border-[3px] border-white/40 flex items-center justify-center active:bg-white/40 opacity-80 pointer-events-auto shadow-md"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isCrouching = true; }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isCrouching = false; }}
          onPointerLeave={() => window.mobileInputs.isCrouching = false}
        >
          <ArrowDown size={20} className="text-white drop-shadow-md" />
        </button>
      </div>
    </div>
  );
};
