import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import { useUIStore } from '../store/UIStore';
import { useGameStore } from '../store/gameStore';
import { networkManager } from '../game/NetworkManager';
import { audioManager } from '../game/AudioManager';
import { settingsManager } from '../game/Settings';
import { ITEM_NAMES } from '../game/Constants';

import { PointerLockStateMachine } from '../game/PointerLockStateMachine';

export function useGameEngine() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [targetServer, setTargetServer] = useState<string>('skybridge');
  const currentMode = useGameStore(state => state.currentMode);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const [showDebug, setShowDebug] = useState(false);
  const pointerLockSM = useRef(new PointerLockStateMachine());
  const suppressPauseMenu = useRef(false);

  const [gameKey, setGameKey] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.className = "absolute inset-0 w-full h-full";
    containerRef.current.appendChild(canvas);

    const newGame = new Game(canvas);
    setGame(newGame);
    newGame.start();
    newGame.player.renderer.setHandVisible(useUIStore.getState().isHUDVisible);

    const resizeObserver = new ResizeObserver(() => {
      newGame.onWindowResize();
    });
    resizeObserver.observe(containerRef.current);

    const handleLockChange = () => {
      const locked = document.pointerLockElement === document.body;
      useUIStore.getState().setLocked(locked);
      if (!locked) {
        // Open pause menu when unlocking if not in other specific menus and not suppressed
        setTimeout(() => {
          const state = useUIStore.getState();
          if (!suppressPauseMenu.current && 
              !state.isInventoryOpen && 
              !state.isShopOpen && 
              !state.isSettingsOpen && 
              !state.isChestOpen && 
              !state.isTyping) {
            state.setPauseMenuOpen(true);
          }
          suppressPauseMenu.current = false;
        }, 50);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useUIStore.getState();
      const { isTyping: typing, isLocked: locked, isInventoryOpen: inv, isShopOpen: shop, isSettingsOpen: settings, isPauseMenuOpen: pause, isChestOpen: chest } = state;

      const isInputFocused = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      // Ignore standard keybinds when typing in an input
      if (isInputFocused && e.code !== 'Escape' && e.code !== 'Enter') return;

      if (typing && e.code !== 'Enter' && e.code !== 'Escape') return;

      if (e.code === 'F3') {
        e.preventDefault();
        settingsManager.updateSettings({ showDebug: !settingsManager.getSettings().showDebug });
      }
      
      const { keybinds } = settingsManager.getSettings();

      if (e.code === keybinds.inventory) {
        if (typing || newGame.world.isHub) return;
        if (chest) {
          state.setChestOpen(false);
          handleStart(null);
          return;
        }
        state.setInventoryOpen(!state.isInventoryOpen);
        if (!state.isInventoryOpen) {
          suppressPauseMenu.current = true;
          newGame.controls.unlock();
          state.setSettingsOpen(false);
          state.setPauseMenuOpen(false);
        } else {
          handleStart(null);
        }
      }

      if (e.code === 'Enter') {
        if (locked && !isInputFocused) {
          // Do not unlock controls here to keep chat completely seamless
          state.setTyping(true);
        }
      }

      if (e.code === keybinds.toggleHUD) {
        const nextVisible = !state.isHUDVisible;
        state.setHUDVisible(nextVisible);
        newGame.player.renderer.setHandVisible(nextVisible);
      }

      if (e.code === 'Escape') {
        const { 
          isInventoryOpen: inv, 
          isShopOpen: shop, 
          isSettingsOpen: settings, 
          isPauseMenuOpen: pause, 
          isTyping: typing, 
          isChestOpen: chest,
          isServerJoinOpen: serverJoin,
          isLaunchMenuOpen: launchMenu
        } = state;

        if (isInputFocused) {
          (e.target as HTMLElement).blur();
          return;
        }

        if (inv || shop || settings || pause || typing || chest || serverJoin || launchMenu) {
          state.setInventoryOpen(false);
          state.setShopOpen(false);
          state.setSettingsOpen(false);
          state.setPauseMenuOpen(false);
          state.setChestOpen(false);
          state.setTyping(false);
          state.setServerJoinOpen(false);
          state.setLaunchMenuOpen(false);
          
          if (!isMobile) {
            trySafeLock(true);
          }
        } else {
          newGame.controls.unlock();
          state.setPauseMenuOpen(true);
        }
      }
    };

    const handleOpenShop = (e: any) => {
      useUIStore.getState().setCurrentNPC(e.detail.npc);
      suppressPauseMenu.current = true;
      useUIStore.getState().setShopOpen(true);
      newGame.controls.unlock();
    };

    const handleOpenServerJoin = (e: any) => {
      const server = e.detail?.server || 'skybridge';
      setTargetServer(server);
      useUIStore.getState().setCurrentNPC(e.detail?.npc || null);
      suppressPauseMenu.current = true;
      useUIStore.getState().setServerJoinOpen(true);
      newGame.controls.unlock();
    };

    const handleOpenLaunchMenu = () => {
      suppressPauseMenu.current = true;
      useUIStore.getState().setLaunchMenuOpen(true);
      newGame.controls.unlock();
    };

    const handleOpenChest = () => {
      suppressPauseMenu.current = true;
      useUIStore.getState().setChestOpen(true);
      newGame.controls.unlock();
    };

    const handleForceCloseMenus = () => {
      const state = useUIStore.getState();
      state.setInventoryOpen(false);
      state.setShopOpen(false);
      state.setSettingsOpen(false);
      state.setPauseMenuOpen(false);
      state.setChestOpen(false);
      state.setTyping(false);
      suppressPauseMenu.current = true;
      if (!isMobile) {
        trySafeLock();
      }
    };

    const trySafeLock = (isEscapeKey = false) => {
      if (document.pointerLockElement === document.body) return;
      if (isMobile) return;
        
      if (!pointerLockSM.current.canLock() || isEscapeKey) {
        return;
      }
      
      try {
        newGame.controls.lock();
        audioManager.resume();
      } catch (err) {
        console.warn('Pointer lock sync request failed:', err);
      }
    };

    let fastUIAF: number;
    let lastRaycastTime = 0;
    const updateFastUI = (time: number) => {
      // Throttle crosshair/raycast updates to 10Hz (every 100ms) instead of 60fps
      if (time - lastRaycastTime > 100) {
        const store = useGameStore.getState();
        if (store.isUnderwater !== newGame.player.isUnderwater) {
          store.setIsUnderwater(newGame.player.isUnderwater);
        }
        if (store.isUnderLava !== newGame.player.isUnderLava) {
          store.setIsUnderLava(newGame.player.isUnderLava);
        }
        
        // Update target info for crosshair
        if (newGame.lastRaycast) {
          if (newGame.lastRaycast.npc) {
            const npc = newGame.lastRaycast.npc;
            const current = useGameStore.getState().targetInfo;
            if (current?.id !== npc?.id) {
              useGameStore.getState().setTargetInfo({ type: 'npc', name: npc.name, id: npc.id });
            }
          } else if (newGame.lastRaycast.block) {
            const block = newGame.lastRaycast.block;
            const newName = ITEM_NAMES[block.blockType] || 'Block';
            const current = useGameStore.getState().targetInfo;
            if (current?.type !== 'block' || current?.name !== newName) {
              useGameStore.getState().setTargetInfo({ type: 'block', name: newName });
            }
          } else {
            const current = useGameStore.getState().targetInfo;
            if (current?.type !== null) {
              useGameStore.getState().setTargetInfo({ type: null, name: null });
            }
          }
        }
        lastRaycastTime = time;
      }
      fastUIAF = requestAnimationFrame(updateFastUI);
    };

    // Poll for fast spatial UI changes
    fastUIAF = requestAnimationFrame(updateFastUI);

    const handleWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== document.body) return;
      if (newGame.world.isHub) return;
      
      let nextIndex = newGame.player.hotbarIndex + (e.deltaY > 0 ? 1 : -1);
      
      if (nextIndex < 0) nextIndex = 8;
      if (nextIndex >= 9) nextIndex = 0;
      
      newGame.player.hotbarIndex = nextIndex;
      useGameStore.getState().setHotbarIndex(nextIndex);
    };

    const handleRequestRespawn = () => {
      newGame.player.respawn();
    };

    const handlePlayerDied = () => {
      newGame.player.respawn();
    };

    const handleRequestGameRestart = () => {
      const state = useUIStore.getState();
      state.setPauseMenuOpen(false);
      state.setServerJoinOpen(false);
      state.setShopOpen(false);
      state.setInventoryOpen(false);
      setGameKey(k => k + 1);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handlePointerLockError = () => {
      console.warn('Pointer lock failed, restoring pause menu.');
      if (!newGame.world.isHub) {
        useUIStore.getState().setPauseMenuOpen(true);
      }
    };

    document.addEventListener('pointerlockerror', handlePointerLockError);
    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('openShop', handleOpenShop as EventListener);
    window.addEventListener('openChest', handleOpenChest as EventListener);
    window.addEventListener('forceCloseMenus', handleForceCloseMenus as EventListener);
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const server = p.get('server') || 'hub';
      networkManager.initMatchmaking(server).then(() => {
        setGameKey(k => k + 1);
      }).catch(() => {
        setGameKey(k => k + 1);
      });
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('openServerJoin', handleOpenServerJoin as EventListener);
    window.addEventListener('openLaunchMenu', handleOpenLaunchMenu as EventListener);
    window.addEventListener('requestRespawn', handleRequestRespawn as EventListener);
    window.addEventListener('playerDied', handlePlayerDied as EventListener);
    window.addEventListener('requestGameRestart', handleRequestGameRestart as EventListener);

    const urlParams = new URLSearchParams(window.location.search);
    const serverName = urlParams.get('server') || 'hub';
    if (serverName.startsWith('hub')) {
      setTimeout(() => {
        networkManager.receiveLocalMessage('System', '§bWelcome to Starplex.io hub! §eExplore the area or use /server skybridge or /server skycastles or /server battleroyale to join the game.');
      }, 2000);
    } else {
      setTimeout(() => {
        networkManager.receiveLocalMessage('System', `§bWelcome to ${serverName.startsWith('skycastles') ? 'SkyCastles' : serverName.startsWith('battleroyale') ? 'Battle Royale' : 'SkyBridge'}!`);
      }, 2000);
    }

    return () => {
      pointerLockSM.current.dispose();
      resizeObserver.disconnect();
      newGame.stop();
      if (containerRef.current && canvas.parentNode === containerRef.current) {
        containerRef.current.removeChild(canvas);
      }
      cancelAnimationFrame(fastUIAF);
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel, { passive: false } as any);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('openShop', handleOpenShop as EventListener);
      window.removeEventListener('openChest', handleOpenChest as EventListener);
      window.removeEventListener('forceCloseMenus', handleForceCloseMenus as EventListener);
      window.removeEventListener('openServerJoin', handleOpenServerJoin as EventListener);
      window.removeEventListener('openLaunchMenu', handleOpenLaunchMenu as EventListener);
      window.removeEventListener('requestRespawn', handleRequestRespawn as EventListener);
      window.removeEventListener('playerDied', handlePlayerDied as EventListener);
      window.removeEventListener('requestGameRestart', handleRequestGameRestart as EventListener);
    };
  }, [gameKey]);

  useEffect(() => {
    return settingsManager.subscribe((s) => setShowDebug(s.showDebug));
  }, []);

  const handleStart = async (e: any) => {
    if (e) e.stopPropagation();

    if (isMobile) {
      try {
        if (!document.fullscreenElement) {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          } else if ((document.documentElement as any).webkitRequestFullscreen) {
            await ((document.documentElement as any).webkitRequestFullscreen)();
          }
        }
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('landscape');
        }
      } catch (err) {
        console.warn("Fullscreen/Orientation lock failed:", err);
      }
    }

    const uiState = useUIStore.getState();
    if (game && !game.controls.isLocked && !uiState.isInventoryOpen && !uiState.isShopOpen && !uiState.isSettingsOpen && !uiState.isPauseMenuOpen && !uiState.isServerJoinOpen) {
      const isTouch = e && e.pointerType === 'touch';
      if (isTouch) {
        try {
          audioManager.resume();
        } catch (err) {}
        return;
      }

      if (!pointerLockSM.current.canLock()) {
        return;
      }

      try {
        game.controls.lock();
        audioManager.resume();
      } catch (err) {
        console.warn('Pointer lock request failed:', err);
      }
    }
  };

  return {
    containerRef,
    game,
    isMobile,
    targetServer,
    showDebug,
    handleStart,
    setGameKey,
    gameKey
  };
}
