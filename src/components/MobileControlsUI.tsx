import React, { useEffect, useRef, useState } from 'react';
import { useUI } from '../store/uiStore';
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

import { Menu, Backpack, MessageSquare, Camera, ScanEye, Sword, ArrowDown, ChevronsUp, Trophy, BarChart2 } from 'lucide-react';

export const MobileControlsUI: React.FC = () => {
  const isInventoryOpen = useUI(state => state.isInventoryOpen);
  const setInventoryOpen = useUI(state => state.setInventoryOpen);
  const isShopOpen = useUI(state => state.isShopOpen);
  const isSettingsOpen = useUI(state => state.isSettingsOpen);
  const isPauseMenuOpen = useUI(state => state.isPauseMenuOpen);
  const setPauseMenuOpen = useUI(state => state.setPauseMenuOpen);
  const isServerJoinOpen = useUI(state => state.isServerJoinOpen);
  const isLaunchMenuOpen = useUI(state => state.isLaunchMenuOpen);
  const isTyping = useUI(state => state.isTyping);
  const setTyping = useUI(state => state.setTyping);
  const setLocked = useUI(state => state.setLocked);
  
  const showLeaderboard = useGameStore(state => state.showLeaderboard);
  const setShowLeaderboard = useGameStore(state => state.setShowLeaderboard);

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
  const joystickOriginRef = useRef<{x: number, y: number} | null>(null);

  const [joystickOrigin, setJoystickOrigin] = useState<{x: number, y: number} | null>(null);

  useEffect(() => {
    const isTablet = window.innerWidth >= 768;
    maxRadius.current = isTablet ? 96 : 56;

    const handleResize = () => {
      maxRadius.current = window.innerWidth >= 768 ? 96 : 56;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (isAnyMenuOpen) return;
      
      const target = e.target as HTMLElement;
      if (target && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.closest('button')) {
        e.preventDefault();
      }
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        
        if (target && target.closest('.mobile-button')) continue;

        const isBottomLeft = touch.clientX < window.innerWidth * 0.5 && touch.clientY > window.innerHeight * 0.2;
        
        if (isBottomLeft && joystickTouchId.current === null) {
            joystickTouchId.current = touch.identifier;
            joystickOriginRef.current = { x: touch.clientX, y: touch.clientY };
            setJoystickOrigin({ x: touch.clientX, y: touch.clientY });
            continue; // Dedicated joystick touch
        }

        if (lookTouchId.current === null && joystickTouchId.current !== touch.identifier) {
            lookTouchId.current = touch.identifier;
            lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        }

        if (joystickTouchId.current !== touch.identifier) {
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
        
        if (touch.identifier === joystickTouchId.current) {
            const origin = joystickOriginRef.current;
            if (origin) {
                const dx = touch.clientX - origin.x;
                const dy = touch.clientY - origin.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                let normalizedX = dx / maxRadius.current;
                let normalizedY = dy / maxRadius.current;
                
                let isSprinting = false;
                if (distance > maxRadius.current) {
                    normalizedX = dx / distance;
                    normalizedY = dy / distance;
                    if (distance > maxRadius.current * 1.3 && normalizedY < -0.5) isSprinting = true;
                }
                
                if (distance < maxRadius.current * 0.25) {
                    normalizedX = 0;
                    normalizedY = 0;
                }
                
                setJoystick({ x: normalizedX, y: normalizedY });
                window.mobileInputs.joystickX = normalizedX;
                window.mobileInputs.joystickY = normalizedY;
                window.mobileInputs.isSprinting = isSprinting;
            }
            continue;
        }
        
        const tap = activeTaps.current.get(touch.identifier);
        if (tap) {
            const dx = touch.clientX - tap.x;
            const dy = touch.clientY - tap.y;
            if (dx*dx + dy*dy > 100) {
                tap.isSwipe = true;
                if (!tap.isHolding) {
                   clearTimeout(tap.holdTimeout);
                }
            }
        }

        if (touch.identifier === lookTouchId.current && lastLookPos.current) {
          const dx = touch.clientX - lastLookPos.current.x;
          const dy = touch.clientY - lastLookPos.current.y;
          
          const isLandscape = window.innerWidth > window.innerHeight;
          const scale = window.innerWidth >= 768 ? 1.0 : (isLandscape ? 6.0 : 1.5);
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
            joystickOriginRef.current = null;
            setJoystickOrigin(null);
            setJoystick({ x: 0, y: 0 });
            window.mobileInputs.joystickX = 0;
            window.mobileInputs.joystickY = 0;
            window.mobileInputs.isSprinting = false;
            continue;
        }

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
      joystickOriginRef.current = null;
      setJoystickOrigin(null);
      joystickPointerId.current = null;
    }
  }, [isAnyMenuOpen]);

  // If a menu is open, don't show controls, but let hotbar clicks work? The hotbar is shown on bottom.
  if (isAnyMenuOpen) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden touch-none">
      {/* Top HUD Buttons */}
      <div 
        className="absolute flex gap-2 pointer-events-auto transform origin-top-right scale-[0.8] landscape:scale-[0.8]"
        style={{ 
          top: 'calc(0.5rem + env(safe-area-inset-top))', 
          right: 'calc(0.5rem + env(safe-area-inset-right))' 
        }}
      >
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
          className="w-12 h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:bg-white/40 mobile-button pointer-events-auto touch-none"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.triggerPerspective = true; }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.triggerPerspective = true; }}
        >
          <Camera size={20} />
        </button>
        <button 
          className="w-12 h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:bg-white/40 mobile-button pointer-events-auto target-stats-btn portrait:hidden"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowLeaderboard(true); }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setShowLeaderboard(true); }}
        >
          <BarChart2 size={20} />
        </button>
        <button 
          className="w-12 h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:bg-white/40 mobile-button pointer-events-auto"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setTyping(true); setLocked(false); }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setTyping(true); setLocked(false); }}
        >
          <MessageSquare size={20} />
        </button>
        <button 
          className="w-12 h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:bg-white/40 mobile-button pointer-events-auto"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setInventoryOpen(true); setLocked(false); }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setInventoryOpen(true); setLocked(false); }}
        >
          <Backpack size={20} />
        </button>
        <button 
          className="w-12 h-12 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white active:bg-white/40 mobile-button pointer-events-auto"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setPauseMenuOpen(true); setLocked(false); }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setPauseMenuOpen(true); setLocked(false); }}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Target Crosshair */}
      <div className="absolute top-1/2 left-1/2 min-w-4 min-h-4 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-white/50">
        <Crosshair size={24} />
      </div>

      {/* Floating Joystick Area (Left half) */}
      <div 
        ref={joystickRef}
        data-joystick-area="true"
        className="absolute top-0 bottom-16 landscape:bottom-24 z-50 pointer-events-none touch-none"
        style={{ 
          left: 'calc(0px + env(safe-area-inset-left))',
          width: 'calc(50% - env(safe-area-inset-left))'
        }}
      >
        {!joystickOrigin && (
          <div 
            className="absolute w-32 h-32 md:w-36 md:h-36 bg-white/5 border-2 border-white/10 rounded-full flex items-center justify-center pointer-events-none -translate-x-1/2 -translate-y-1/2 left-[30%] top-[60%] landscape:left-[25%] landscape:top-[75%]"
          >
             <div className="w-12 h-12 md:w-16 md:h-16 border-2 border-white/20 bg-white/10 rounded-full shadow-lg pointer-events-none" />
          </div>
        )}
        {joystickOrigin && (
          <div 
            className="absolute w-32 h-32 md:w-36 md:h-36 bg-black/20 border border-white/20 rounded-full flex items-center justify-center p-2 pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ left: joystickOrigin.x, top: joystickOrigin.y }}
          >
             <div 
                className={`w-12 h-12 md:w-16 md:h-16 border-2 rounded-full shadow-lg pointer-events-none flex items-center justify-center transition-colors ${window.mobileInputs.isSprinting ? 'bg-white/60 border-white/80' : 'bg-white/40 border-white/60'}`}
                style={{ 
                   transform: `translate(${joystick.x * 125}%, ${joystick.y * 125}%)`,
                   transition: joystickPointerId.current === null ? 'transform 0.15s ease-out' : 'none'
                }}
             >
               {window.mobileInputs.isSprinting ? (
                 <ChevronsUp size={24} className="text-white drop-shadow-md opacity-100" />
               ) : (
                 <Navigation size={20} className={`text-white drop-shadow-md ${joystick.y < -0.5 ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
               )}
             </div>
          </div>
        )}
      </div>

      {/* Action Buttons (Right side - Diamond layout for thumbs) */}
      <div 
        className="absolute pointer-events-none w-44 h-44 landscape:w-36 landscape:h-36 transform origin-bottom-right scale-[0.75] sm:scale-90 landscape:scale-[0.65] md:landscape:scale-[0.8] lg:landscape:scale-[0.75]"
        style={{
          bottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
          right: 'calc(0.5rem + env(safe-area-inset-right))'
        }}
      >
        {/* Jump Button (Top) */}
        <button 
          className="absolute top-0 left-1/2 -translate-x-1/2 mobile-button w-14 h-14 landscape:w-12 landscape:h-12 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isJumping = true; e.currentTarget.setPointerCapture?.(e.pointerId); }}
          onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isJumping = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onPointerCancel={(e) => { e.stopPropagation(); window.mobileInputs.isJumping = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isJumping = true; }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isJumping = false; }}
          onTouchCancel={(e) => { e.stopPropagation(); window.mobileInputs.isJumping = false; }}
        >
          <ArrowUp size={24} className="text-white drop-shadow-md" />
        </button>

        {/* Interact Button (Left) */}
        <button 
          className="absolute top-1/2 left-0 -translate-y-1/2 mobile-button w-14 h-14 landscape:w-12 landscape:h-12 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isInteracting = true; e.currentTarget.setPointerCapture?.(e.pointerId); }}
          onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isInteracting = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onPointerCancel={(e) => { e.stopPropagation(); window.mobileInputs.isInteracting = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isInteracting = true; }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isInteracting = false; }}
          onTouchCancel={(e) => { e.stopPropagation(); window.mobileInputs.isInteracting = false; }}
        >
          <Hand size={24} className="text-white drop-shadow-md" />
        </button>
        
        {/* Attack/Mine Button (Right) */}
        <button 
          className="absolute top-1/2 right-0 -translate-y-1/2 mobile-button w-16 h-16 landscape:w-14 landscape:h-14 rounded-full bg-white/20 border-[3px] border-white/50 flex items-center justify-center active:bg-white/40 pointer-events-auto shadow-lg"
          onPointerDown={(e) => { 
            e.preventDefault(); 
            e.stopPropagation();
            isButtonAttacking.current = true;
            window.mobileInputs.isAttacking = true;
            e.currentTarget.setPointerCapture?.(e.pointerId); 
          }}
          onPointerUp={(e) => { 
            e.preventDefault(); 
            e.stopPropagation();
            isButtonAttacking.current = false;
            
            let anyHolding = false;
            activeTaps.current.forEach(t => { if (t.isHolding) anyHolding = true; });
            window.mobileInputs.isAttacking = isButtonAttacking.current || anyHolding;
            
            e.currentTarget.releasePointerCapture?.(e.pointerId); 
          }}
          onPointerCancel={(e) => { 
            e.stopPropagation();
            isButtonAttacking.current = false;
            let anyHolding = false;
            activeTaps.current.forEach(t => { if (t.isHolding) anyHolding = true; });
            window.mobileInputs.isAttacking = isButtonAttacking.current || anyHolding;
            e.currentTarget.releasePointerCapture?.(e.pointerId); 
          }}
          onTouchStart={(e) => { 
            e.preventDefault(); 
            e.stopPropagation();
            isButtonAttacking.current = true;
            window.mobileInputs.isAttacking = true;
          }}
          onTouchEnd={(e) => { 
            e.preventDefault(); 
            e.stopPropagation();
            isButtonAttacking.current = false;
            
            let anyHolding = false;
            activeTaps.current.forEach(t => { if (t.isHolding) anyHolding = true; });
            window.mobileInputs.isAttacking = isButtonAttacking.current || anyHolding;
          }}
          onTouchCancel={(e) => { 
            e.stopPropagation();
            isButtonAttacking.current = false;
            let anyHolding = false;
            activeTaps.current.forEach(t => { if (t.isHolding) anyHolding = true; });
            window.mobileInputs.isAttacking = isButtonAttacking.current || anyHolding;
          }}
        >
          <Sword size={28} className="text-white drop-shadow-md" />
        </button>

        {/* Crouch Button (Bottom) */}
        <button 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 mobile-button w-12 h-12 landscape:w-10 landscape:h-10 rounded-full bg-white/20 border-[3px] border-white/40 flex items-center justify-center active:bg-white/40 opacity-80 pointer-events-auto shadow-md"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isCrouching = true; e.currentTarget.setPointerCapture?.(e.pointerId); }}
          onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isCrouching = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onPointerCancel={(e) => { e.stopPropagation(); window.mobileInputs.isCrouching = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isCrouching = true; }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); window.mobileInputs.isCrouching = false; }}
          onTouchCancel={(e) => { e.stopPropagation(); window.mobileInputs.isCrouching = false; }}
        >
          <ArrowDown size={20} className="text-white drop-shadow-md" />
        </button>
      </div>
    </div>
  );
};
