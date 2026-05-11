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
  const isButtonAttacking = useRef(false);

  const [joystick, setJoystick] = useState({ x: 0, y: 0 });
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickPointerId = useRef<number | null>(null);

  const startJoystick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (joystickPointerId.current !== null) return;
    joystickPointerId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    updateJoystickInputs(e);
  };

  const updateJoystick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateJoystickInputs(e);
  };
  
  const updateJoystickInputs = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2;
    
    let normalizedX = dx / maxRadius;
    let normalizedY = dy / maxRadius;

    if (distance > maxRadius) {
      normalizedX = dx / distance;
      normalizedY = dy / distance;
    }
    
    if (distance < maxRadius * 0.15) {
      normalizedX = 0;
      normalizedY = 0;
    }
    
    setJoystick({ x: normalizedX, y: normalizedY });
    window.mobileInputs.joystickX = normalizedX;
    window.mobileInputs.joystickY = normalizedY;
  };

  const stopJoystick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    joystickPointerId.current = null;
    window.mobileInputs.joystickX = 0;
    window.mobileInputs.joystickY = 0;
    setJoystick({ x: 0, y: 0 });
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch(err) {}
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
        
        if (target && !target.closest('.mobile-button') && !target.closest('.pointer-events-auto')) {
          if (lookTouchId.current === null) {
            lookTouchId.current = touch.identifier;
            lastLookPos.current = { x: touch.clientX, y: touch.clientY };
          }

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
                   window.mobileInputs.isAttacking = isButtonAttacking.current || anyHolding;
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
      window.mobileInputs.isAttacking = isButtonAttacking.current || anyHolding;
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

  useEffect(() => {
    if (isAnyMenuOpen) {
      // Clear movement inputs when menus open to prevent getting stuck
      window.mobileInputs.joystickX = 0;
      window.mobileInputs.joystickY = 0;
      window.mobileInputs.isJumping = false;
      window.mobileInputs.isSprinting = false;
      window.mobileInputs.isCrouching = false;
      window.mobileInputs.isInteracting = false;
      window.mobileInputs.isAttacking = false;
      window.mobileInputs.isZooming = false;
      
      setJoystick({ x: 0, y: 0 });
      joystickPointerId.current = null;
    }
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
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
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
            (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
          }}
          onPointerCancel={(e) => { 
            window.mobileInputs.isZooming = false;
            window.mobileInputs.zoomJoystickX = 0;
            window.mobileInputs.zoomJoystickY = 0;
            lastZoomLookPos.current = null;
            (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
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

      {/* Joystick Container (Left side) */}
      <div 
        ref={joystickRef}
        className="absolute bottom-6 left-6 w-32 h-32 md:w-36 md:h-36 landscape:w-32 landscape:h-32 landscape:bottom-6 landscape:left-6 safe-ml safe-mb z-50 pointer-events-auto touch-none bg-black/20 border border-white/20 rounded-full flex items-center justify-center p-2"
        onPointerDown={startJoystick}
        onPointerMove={updateJoystick}
        onPointerUp={stopJoystick}
        onPointerCancel={stopJoystick}
        onContextMenu={(e) => e.preventDefault()}
      >
         <div 
            className="w-12 h-12 md:w-16 md:h-16 bg-white/40 border-2 border-white/60 rounded-full shadow-lg pointer-events-none flex items-center justify-center"
            style={{ 
               transform: `translate(${joystick.x * 125}%, ${joystick.y * 125}%)`,
               transition: joystickPointerId.current === null ? 'transform 0.15s ease-out' : 'none'
            }}
         >
           <Navigation size={20} className={`text-white drop-shadow-md ${joystick.y < -0.5 ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
         </div>
      </div>

      {/* Action Buttons (Right side - Diamond layout for thumbs) */}
      <div className="absolute bottom-4 right-4 pointer-events-none w-44 h-44 landscape:w-36 landscape:h-36 landscape:bottom-2 landscape:right-2 safe-mr safe-mb transform origin-bottom-right scale-[0.75] sm:scale-100 landscape:scale-[0.65] md:landscape:scale-100">
        {/* Drop Button (Top Left) */}
        <button 
          className="absolute top-0 left-0 mobile-button w-12 h-12 landscape:w-10 landscape:h-10 rounded-full bg-red-500/20 border-[3px] border-red-500/40 flex items-center justify-center active:bg-red-500/40 opacity-80 pointer-events-auto shadow-md text-red-100"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.triggerDrop = true; }}
        >
          <ArrowDownToLine size={20} className="drop-shadow-md text-red-200" />
        </button>

        {/* Jump Button (Top) */}
        <button 
          className="absolute top-0 left-1/2 -translate-x-1/2 mobile-button w-14 h-14 landscape:w-12 landscape:h-12 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isJumping = true; e.currentTarget.setPointerCapture?.(e.pointerId); }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isJumping = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onPointerCancel={(e) => { window.mobileInputs.isJumping = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
        >
          <ArrowUp size={24} className="text-white drop-shadow-md" />
        </button>
        
        {/* Sprint Button (Top Right corner) */}
        <button 
          className="absolute -top-4 -right-2 mobile-button w-12 h-12 landscape:w-10 landscape:h-10 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isSprinting = true; e.currentTarget.setPointerCapture?.(e.pointerId); }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isSprinting = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onPointerCancel={(e) => { window.mobileInputs.isSprinting = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
        >
          <ChevronsUp size={20} className="text-white drop-shadow-md" />
        </button>

        {/* Interact Button (Left) */}
        <button 
          className="absolute top-1/2 left-0 -translate-y-1/2 mobile-button w-14 h-14 landscape:w-12 landscape:h-12 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isInteracting = true; e.currentTarget.setPointerCapture?.(e.pointerId); }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isInteracting = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onPointerCancel={(e) => { window.mobileInputs.isInteracting = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
        >
          <Hand size={24} className="text-white drop-shadow-md" />
        </button>
        
        {/* Attack/Mine Button (Right) */}
        <button 
          className="absolute top-1/2 right-0 -translate-y-1/2 mobile-button w-16 h-16 landscape:w-14 landscape:h-14 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { 
            e.preventDefault(); 
            isButtonAttacking.current = true;
            window.mobileInputs.isAttacking = true;
            e.currentTarget.setPointerCapture?.(e.pointerId); 
          }}
          onPointerUp={(e) => { 
            e.preventDefault(); 
            isButtonAttacking.current = false;
            
            let anyHolding = false;
            activeTaps.current.forEach(t => { if (t.isHolding) anyHolding = true; });
            window.mobileInputs.isAttacking = isButtonAttacking.current || anyHolding;
            
            e.currentTarget.releasePointerCapture?.(e.pointerId); 
          }}
          onPointerCancel={(e) => { 
            isButtonAttacking.current = false;
            let anyHolding = false;
            activeTaps.current.forEach(t => { if (t.isHolding) anyHolding = true; });
            window.mobileInputs.isAttacking = isButtonAttacking.current || anyHolding;
            e.currentTarget.releasePointerCapture?.(e.pointerId); 
          }}
        >
          <Sword size={28} className="text-white drop-shadow-md" />
        </button>

        {/* Crouch Button (Bottom) */}
        <button 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 mobile-button w-12 h-12 landscape:w-10 landscape:h-10 rounded-full bg-white/20 border-[3px] border-white/40 flex items-center justify-center active:bg-white/40 opacity-80 pointer-events-auto shadow-md"
          onPointerDown={(e) => { e.preventDefault(); window.mobileInputs.isCrouching = true; e.currentTarget.setPointerCapture?.(e.pointerId); }}
          onPointerUp={(e) => { e.preventDefault(); window.mobileInputs.isCrouching = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onPointerCancel={(e) => { window.mobileInputs.isCrouching = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
        >
          <ArrowDown size={20} className="text-white drop-shadow-md" />
        </button>
      </div>
    </div>
  );
};
