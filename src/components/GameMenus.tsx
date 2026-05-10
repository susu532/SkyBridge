import { useUI } from '../store/UIStore';
import { useGameStore } from '../store/gameStore';
import { InventoryUI } from './InventoryUI';
import { ChestUI } from './ChestUI';
import { ShopUI } from './ShopUI';
import { SettingsUI } from './SettingsUI';
import { PauseMenuUI } from './PauseMenuUI';
import { ServerJoinUI } from './ServerJoinUI';
import { LaunchMenuUI } from './LaunchMenuUI';
import { Game } from '../game/Game';
import { networkManager } from '../game/NetworkManager';
import * as THREE from 'three';

export function GameMenus({ game, targetServer, handleStart, setGameKey }: any) {
  const {
    isInventoryOpen, setInventoryOpen,
    isChestOpen, setChestOpen,
    isShopOpen, setShopOpen,
    isSettingsOpen, setSettingsOpen,
    isPauseMenuOpen, setPauseMenuOpen,
    isServerJoinOpen, setServerJoinOpen,
    isLaunchMenuOpen, setLaunchMenuOpen,
    currentNPC, setCurrentNPC
  } = useUI();
  const currentMode = useGameStore(state => state.currentMode);

  if (!game) return null;

  return (
    <>
      {currentMode !== 'hub' && (
        <div onClick={(e) => e.stopPropagation()}>
          <InventoryUI 
            inventory={game.player.inventory} 
            isOpen={isInventoryOpen} 
            onClose={() => setInventoryOpen(false)} 
            onDropItem={(type: any, count: number) => {
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
            onDropItem={(type: any, count: number) => {
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
      <div onClick={(e) => e.stopPropagation()}>
        <ShopUI
          npc={currentNPC}
          inventory={game.player.inventory}
          isOpen={isShopOpen}
          onClose={() => setShopOpen(false)}
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
              typeof setGameKey === 'function' && setGameKey((k: number) => k + 1);
            }).catch(() => {
              typeof setGameKey === 'function' && setGameKey((k: number) => k + 1);
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
              game.player.velocity.y = 160;
              game.player.isGliding = true;
            }
          }}
        />
      </div>
    </>
  );
}
