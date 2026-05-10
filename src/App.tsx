/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { BLOCK } from './game/TextureAtlas';
import { InventoryUI } from './components/InventoryUI';
import { ChestUI } from './components/ChestUI';
import { ShopUI } from './components/ShopUI';
import { ChatUI } from './components/ChatUI';
import { ITEM_COLORS, ITEM_NAMES } from './game/Constants';
import { getTextureAtlasDataUrl, getBlockUVs } from './game/TextureAtlas';
import { NPC } from './game/NPC';
import { ItemIcon } from './components/inventory/Slot';
import { ServerJoinUI } from './components/ServerJoinUI';
import { StatsPanel } from './components/StatsPanel';
import { ItemType } from './game/Inventory';
import { networkManager } from './game/NetworkManager';
import { audioManager } from './game/AudioManager';
import { SettingsUI } from './components/SettingsUI';
import { PauseMenuUI } from './components/PauseMenuUI';
import { SkyBridgeSidebar } from './components/SkyBridgeSidebar';
import { SkyCastlesSidebar } from './components/SkyCastlesSidebar';
import { BattleRoyaleSidebar } from './components/BattleRoyaleSidebar';
import { SkyBridgeActionBar } from './components/SkyBridgeActionBar';
import { SkyBridgeXPPopup } from './components/SkyBridgeXPPopup';
import { DamageOverlay } from './components/DamageOverlay';
import { DamageNumbers } from './components/DamageNumbers';
import { HotbarUI } from './components/HotbarUI';
import { useGameStore } from './store/gameStore';
import { GameMessages } from './components/GameMessages';
import { LevelUpUI } from './components/LevelUpUI';
import { DebugInfo } from './components/DebugInfo';
import { EntityTags } from './components/EntityTags';
import { LaunchMenuUI } from './components/LaunchMenuUI';
import { MobileControlsUI } from './components/MobileControlsUI';
import { MapLoadingScreen } from './components/MapLoadingScreen';
import { TopObjectiveHUD } from './components/TopObjectiveHUD';
import { HubTitleUI } from './components/HubTitleUI';
import { settingsManager } from './game/Settings';
import { Settings as SettingsIcon, Maximize } from 'lucide-react';
import { useUI } from './store/UIStore';
import * as THREE from 'three';

export default function App() {
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
    isUnderLava
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

  const blockInfo = {
    [BLOCK.DIRT]: { name: 'Dirt', color: '#5C4033', key: '1' },
    [BLOCK.STONE]: { name: 'Stone', color: '#888888', key: '2' },
    [BLOCK.WOOD]: { name: 'Wood', color: '#6b4d29', key: '3' },
    [BLOCK.LEAVES]: { name: 'Leaves', color: '#2d6a14', key: '4' },
    [BLOCK.GLASS]: { name: 'Glass', color: '#c8c8ff', key: '5' },
    [BLOCK.SAND]: { name: 'Sand', color: '#d2b48c', key: '6' },
    [BLOCK.BLUE_STONE]: { name: 'Blue', color: '#2a52be', key: '7' },
    [BLOCK.RED_STONE]: { name: 'Red', color: '#be2a2a', key: '8' },
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-black font-sans cursor-crosshair"
      onClick={handleStart}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* Vignette Effect */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_50%,rgba(0,0,0,0.4)_100%)]" />

      {/* Underwater Overlay */}
      {isUnderwater && !isUnderLava && (
        <div className="absolute inset-0 pointer-events-none bg-blue-600/30 backdrop-blur-[2px] animate-pulse" />
      )}

      {/* Lava Overlay */}
      {isUnderLava && (
        <div className="absolute inset-0 pointer-events-none bg-orange-600/60 backdrop-blur-[4px] animate-pulse mix-blend-overlay" />
      )}
      {isUnderLava && (
        <div className="absolute inset-0 pointer-events-none bg-red-900/40" />
      )}

      {/* Top HUD */}
      {isHUDVisible && currentMode === 'skycastles' && <TopObjectiveHUD />}

      {/* Hub Title */}
      {currentMode === 'hub' && <HubTitleUI />}

      {/* Debug Menu */}
      <DebugInfo game={game} showDebug={showDebug} />

      {/* Settings/Pause Button */}
      {isHUDVisible && !isMobile && (
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                  console.warn(`Error attempting to enable fullscreen mode: ${err.message}`);
                });
              } else {
                if (document.exitFullscreen) {
                  document.exitFullscreen();
                }
              }
            }}
            className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur-md border border-white/20 transition-all group"
            title="Toggle Fullscreen"
          >
            <Maximize className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (game) game.controls.unlock();
              setPauseMenuOpen(true);
            }}
            className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur-md border border-white/20 transition-all group"
            title="Menu (Esc)"
          >
            <SettingsIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
          </button>
        </div>
      )}

      {/* Crosshair */}
      {isHUDVisible && (
        <div className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 pointer-events-none flex items-center justify-center">
          <div className="w-full h-[2px] bg-white mix-blend-difference" />
          <div className="h-full w-[2px] bg-white mix-blend-difference absolute" />
          {targetInfo.type && (
            <div className="absolute top-6 px-2 py-1 bg-black/80 text-[12px] text-white font-sans drop-shadow-[1px_1px_0_rgba(0,0,0,1)] whitespace-nowrap">
              {targetInfo.name}
              {targetInfo.type === 'npc' && (targetInfo.id === 'hub_npc_q' || targetInfo.id === 'hub_npc_r' || targetInfo.id === 'hub_npc_v' || targetInfo.id === 'hub_npc_dungeon') && currentMode === 'hub' && <span className="ml-2 text-[#FFFF55]">[Right Click to Join]</span>}
              {targetInfo.type === 'npc' && targetInfo.id !== 'hub_npc_q' && targetInfo.id !== 'hub_npc_r' && targetInfo.id !== 'hub_npc_v' && targetInfo.id !== 'hub_npc_dungeon' && <span className="ml-2 text-[#FFFF55]">[Right Click to Talk]</span>}
            </div>
          )}
        </div>
      )}

      {/* Chat */}
      {isHUDVisible && <ChatUI isLocked={isLocked} isTyping={isTyping} setIsTyping={setTyping} />}

      {/* Mob Tags */}
      {isHUDVisible && <EntityTags game={game} />}

      {/* Mobile Controls */}
      {isHUDVisible && isMobile && <MobileControlsUI />}

      {/* SkyBridge Sidebar */}
      {isHUDVisible && currentMode === 'skybridge' && <SkyBridgeSidebar />}
      {isHUDVisible && currentMode === 'skycastles' && <SkyCastlesSidebar />}
      {isHUDVisible && currentMode === 'battleroyale' && <BattleRoyaleSidebar />}

      {/* SkyBridge UI */}
      {isHUDVisible && (currentMode === 'skybridge' || currentMode === 'skycastles') && (
        <>
          <SkyBridgeActionBar />
        </>
      )}
      {isHUDVisible && currentMode === 'skybridge' && (
        <>
          <SkyBridgeXPPopup />
        </>
      )}
      {isHUDVisible && (
        <>
          <DamageOverlay game={game || undefined} />
          <DamageNumbers />
          <GameMessages />
          <LevelUpUI />
        </>
      )}
      {/* Removes DeathScreen entirely to prevent any hidden delays or flashes */}
      {/* Toolbar */}
      {isHUDVisible && currentMode !== 'hub' && <HotbarUI game={game} />}

      {game && currentMode !== 'hub' && (
        <div onClick={(e) => e.stopPropagation()}>
          <InventoryUI 
            inventory={game.player.inventory} 
            isOpen={isInventoryOpen} 
            onClose={() => {
              setInventoryOpen(false);
            }} 
            onDropItem={(type, count) => {
              const direction = new THREE.Vector3();
              game.camera.getWorldDirection(direction);
              const dropPos = game.player.playerHeadPos.clone().add(direction.multiplyScalar(1.5));
              
              for (let i = 0; i < count; i++) {
                networkManager.dropItem(type, {
                  x: dropPos.x + (Math.random() - 0.5) * 0.2,
                  y: dropPos.y + (Math.random() - 0.5) * 0.2,
                  z: dropPos.z + (Math.random() - 0.5) * 0.2
                });
              }
            }}
          />
          <ChestUI
            playerInventory={game.player.inventory}
            chestInventory={game.player.chestInventory}
            isOpen={isChestOpen}
            onClose={() => setChestOpen(false)}
            onDropItem={(type, count) => {
              const direction = new THREE.Vector3();
              game.camera.getWorldDirection(direction);
              const dropPos = game.player.playerHeadPos.clone().add(direction.multiplyScalar(1.5));
              
              for (let i = 0; i < count; i++) {
                networkManager.dropItem(type, {
                  x: dropPos.x + (Math.random() - 0.5) * 0.2,
                  y: dropPos.y + (Math.random() - 0.5) * 0.2,
                  z: dropPos.z + (Math.random() - 0.5) * 0.2
                });
              }
            }}
          />
        </div>
      )}
      {game && (
        <div onClick={(e) => e.stopPropagation()}>
          <ShopUI
            npc={currentNPC}
            inventory={game.player.inventory}
            isOpen={isShopOpen}
            onClose={() => {
              setShopOpen(false);
            }}
          />
          <SettingsUI 
            isOpen={isSettingsOpen} 
            onClose={() => {
              setSettingsOpen(false);
              setPauseMenuOpen(true);
            }} 
          />
          <PauseMenuUI
            isOpen={isPauseMenuOpen}
            onClose={() => {
              setPauseMenuOpen(false);
              handleStart(null);
            }}
            onOpenSettings={() => {
              setPauseMenuOpen(false);
              setSettingsOpen(true);
            }}
          />
          <ServerJoinUI
            isOpen={isServerJoinOpen}
            serverName={targetServer}
            npc={currentNPC}
            onClose={() => {
              setServerJoinOpen(false);
              handleStart(null);
            }}
            onJoin={() => {
              setServerJoinOpen(false);
              setShopOpen(false);
              setCurrentNPC(null);
              networkManager.initMatchmaking(targetServer).then(() => {
                setGameKey(k => k + 1);
              }).catch(() => {
                setGameKey(k => k + 1);
              });
            }}
            onOpenShop={() => {
              setServerJoinOpen(false);
              setShopOpen(true);
            }}
          />
          <LaunchMenuUI
            isOpen={isLaunchMenuOpen}
            onClose={() => {
              setLaunchMenuOpen(false);
              handleStart(null);
            }}
            onLaunch={() => {
              setLaunchMenuOpen(false);
              handleStart(null);
              if (game) {
                // Launch the player
                game.player.velocity.y = 160;
                game.player.isGliding = true;
              }
            }}
          />
        </div>
      )}

      {/* Map Loading Screen */}
      <MapLoadingScreen />

      <StatsPanel />

      {/* Force Landscape Overlay for Mobile */}
      {isMobile && (
        <div className="hidden portrait:flex fixed inset-0 z-[99999] bg-zinc-950 text-white flex-col items-center justify-center text-center p-8 select-none touch-none">
          <div className="w-16 h-28 border-4 border-zinc-500 rounded-xl flex items-center justify-center mb-8 relative">
             <div className="w-8 h-1 bg-zinc-500 rounded-full mt-auto mb-2"></div>
             <div className="absolute inset-0 flex items-center justify-center rotate-90 opacity-50">
               <div className="w-28 h-16 border-4 border-white rounded-xl flex items-center justify-center absolute">
                 <div className="w-1 h-8 bg-white rounded-full ml-auto mr-2"></div>
               </div>
             </div>
          </div>
          <h2 className="text-3xl font-bold mb-3 font-sans tracking-tight text-white">Rotate Device</h2>
          <p className="text-zinc-400 text-lg max-w-[280px] mx-auto leading-relaxed">
            Please rotate your device to landscape mode to play.
          </p>
        </div>
      )}

    </div>
  );
}

