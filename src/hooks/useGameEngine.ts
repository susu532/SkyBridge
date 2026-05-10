import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import { useUI } from '../store/UIStore';
import { useGameStore } from '../store/gameStore';
import { networkManager } from '../game/NetworkManager';
import { audioManager } from '../game/AudioManager';
import { settingsManager } from '../game/Settings';
import { ITEM_NAMES } from '../game/Constants';

export function useGameEngine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const {
    isInventoryOpen, setInventoryOpen,
    isShopOpen, setShopOpen,
    isSettingsOpen, setSettingsOpen,
    isPauseMenuOpen, setPauseMenuOpen,
    isServerJoinOpen, setServerJoinOpen,
    isLaunchMenuOpen, setLaunchMenuOpen,
    isChestOpen, setChestOpen,
    isTyping, setTyping,
    isLocked, setLocked,
    isHUDVisible, setHUDVisible,
    currentNPC, setCurrentNPC
  } = useUI();
  const [isUnderwater, setIsUnderwater] = useState(false);
  const [isUnderLava, setIsUnderLava] = useState(false);
  const [targetServer, setTargetServer] = useState<string>('skybridge');
  const currentMode = useGameStore(state => state.currentMode);

  // Refs for event listeners to avoid stale closures
  const stateRef = useRef({
    isInventoryOpen,
    isShopOpen,
    isSettingsOpen,
    isPauseMenuOpen,
    isServerJoinOpen,
    isLaunchMenuOpen,
    isChestOpen,
    isTyping,
    isLocked,
    isUnderwater,
    isUnderLava,
    isHUDVisible
  });

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    stateRef.current = {
      isInventoryOpen,
      isShopOpen,
      isSettingsOpen,
      isPauseMenuOpen,
      isServerJoinOpen,
      isLaunchMenuOpen,
      isChestOpen,
      isTyping,
      isLocked,
      isUnderwater,
      isUnderLava,
      isHUDVisible
    };
  }, [isInventoryOpen, isShopOpen, isSettingsOpen, isPauseMenuOpen, isServerJoinOpen, isLaunchMenuOpen, isChestOpen, isTyping, isLocked, isUnderwater, isUnderLava, isHUDVisible]);

  const [showDebug, setShowDebug] = useState(false);
  const [targetInfo, setTargetInfo] = useState<{ type: 'block' | 'npc' | null, name: string | null, id?: string }>({ type: null, name: null });
  const lastUnlockTime = useRef(0);
  const suppressPauseMenu = useRef(false);

  const [gameKey, setGameKey] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const newGame = new Game(canvasRef.current);
    setGame(newGame);
    newGame.start();
    newGame.player.renderer.setHandVisible(stateRef.current.isHUDVisible);

    const handleLockChange = () => {
      const locked = document.pointerLockElement === document.body;
      setLocked(locked);
      if (!locked) {
        lastUnlockTime.current = Date.now();
        // Open pause menu when unlocking if not in other specific menus and not suppressed
        setTimeout(() => {
          if (!suppressPauseMenu.current && 
              !stateRef.current.isInventoryOpen && 
              !stateRef.current.isShopOpen && 
              !stateRef.current.isSettingsOpen && 
              !stateRef.current.isChestOpen && 
              !stateRef.current.isTyping) {
            setPauseMenuOpen(true);
          }
          suppressPauseMenu.current = false;
        }, 50);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const { isTyping: typing, isLocked: locked, isInventoryOpen: inv, isShopOpen: shop, isSettingsOpen: settings, isPauseMenuOpen: pause, isChestOpen: chest } = stateRef.current;

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
          setChestOpen(false);
          handleStart(null);
          return;
        }
        setInventoryOpen(!stateRef.current.isInventoryOpen);
        if (!stateRef.current.isInventoryOpen) {
          suppressPauseMenu.current = true;
          newGame.controls.unlock();
          setSettingsOpen(false);
          setPauseMenuOpen(false);
        } else {
          handleStart(null);
        }
      }

      if (e.code === 'Enter') {
        if (locked && !isInputFocused) {
          // Do not unlock controls here to keep chat completely seamless
          setTyping(true);
        }
      }

      if (e.code === keybinds.toggleHUD) {
        const nextVisible = !stateRef.current.isHUDVisible;
        setHUDVisible(nextVisible);
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
        } = stateRef.current;

        if (isInputFocused) {
          (e.target as HTMLElement).blur();
          return;
        }

        if (inv || shop || settings || pause || typing || chest || serverJoin || launchMenu) {
          setInventoryOpen(false);
          setShopOpen(false);
          setSettingsOpen(false);
          setPauseMenuOpen(false);
          setChestOpen(false);
          setTyping(false);
          setServerJoinOpen(false);
          setLaunchMenuOpen(false);
          
          if (!isMobile) {
            trySafeLock(true);
          }
        } else {
          newGame.controls.unlock();
          setPauseMenuOpen(true);
        }
      }
    };

    const handleOpenShop = (e: any) => {
      setCurrentNPC(e.detail.npc);
      suppressPauseMenu.current = true;
      setShopOpen(true);
      newGame.controls.unlock();
    };

    const handleOpenServerJoin = (e: any) => {
      const server = e.detail?.server || 'skybridge';
      setTargetServer(server);
      setCurrentNPC(e.detail?.npc || null);
      suppressPauseMenu.current = true;
      setServerJoinOpen(true);
      newGame.controls.unlock();
    };

    const handleOpenLaunchMenu = () => {
      suppressPauseMenu.current = true;
      setLaunchMenuOpen(true);
      newGame.controls.unlock();
    };

    const handleOpenChest = () => {
      suppressPauseMenu.current = true;
      setChestOpen(true);
      newGame.controls.unlock();
    };

    const handleForceCloseMenus = () => {
      setInventoryOpen(false);
      setShopOpen(false);
      setSettingsOpen(false);
      setPauseMenuOpen(false);
      setChestOpen(false);
      setTyping(false);
      suppressPauseMenu.current = true;
      if (!isMobile) {
        trySafeLock();
      }
    };

    const trySafeLock = (isEscapeKey = false) => {
      if (document.pointerLockElement === document.body) return;
      if (isMobile) return;
      
      const now = Date.now();
      const hasCooldown = now - lastUnlockTime.current < 1250;
      
      const hasActivation = ('userActivation' in navigator) 
        ? (navigator as any).userActivation.isActive 
        : true;
        
      if (hasCooldown || !hasActivation || isEscapeKey) {
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
        setIsUnderwater(prev => prev === newGame.player.isUnderwater ? prev : newGame.player.isUnderwater);
        setIsUnderLava(prev => prev === newGame.player.isUnderLava ? prev : newGame.player.isUnderLava);
        
        // Update target info for crosshair
        if (newGame.lastRaycast) {
          if (newGame.lastRaycast.npc) {
            const npc = newGame.lastRaycast.npc;
            setTargetInfo(prev => prev.id === npc.id ? prev : { type: 'npc', name: npc.name, id: npc.id });
          } else if (newGame.lastRaycast.block) {
            const block = newGame.lastRaycast.block;
            const newName = ITEM_NAMES[block.blockType] || 'Block';
            setTargetInfo(prev => prev.type === 'block' && prev.name === newName ? prev : { type: 'block', name: newName });
          } else {
            setTargetInfo(prev => prev.type === null ? prev : { type: null, name: null });
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
      setPauseMenuOpen(false);
      setServerJoinOpen(false);
      setShopOpen(false);
      setInventoryOpen(false);
      setGameKey(k => k + 1);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handlePointerLockError = () => {
      console.warn('Pointer lock failed, restoring pause menu.');
      if (!newGame.world.isHub) {
        setPauseMenuOpen(true);
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
      newGame.stop();
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

    if (game && !game.controls.isLocked && !isInventoryOpen && !isShopOpen && !isSettingsOpen && !isPauseMenuOpen && !isServerJoinOpen) {
      const now = Date.now();
      const hasCooldown = now - lastUnlockTime.current < 1250;
      
      const hasActivation = ('userActivation' in navigator) 
        ? (navigator as any).userActivation.isActive 
        : true;

      if (hasCooldown || !hasActivation) {
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
    canvasRef,
    game,
    isMobile,
    isUnderwater,
    isUnderLava,
    targetServer,
    targetInfo,
    showDebug,
    handleStart,
    setGameKey
  };
}
