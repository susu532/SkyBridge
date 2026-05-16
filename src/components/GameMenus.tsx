import { lazy, Suspense } from 'react';
import { useUI } from '../store/UIStore';
import { useGameStore } from '../store/gameStore';
import { InventoryUI } from './InventoryUI';
import { ChestUI } from './ChestUI';

const ShopUI = lazy(() => import('./ShopUI').then(m => ({ default: m.ShopUI })));
const SettingsUI = lazy(() => import('./SettingsUI').then(m => ({ default: m.SettingsUI })));
const PauseMenuUI = lazy(() => import('./PauseMenuUI').then(m => ({ default: m.PauseMenuUI })));
const ServerJoinUI = lazy(() => import('./ServerJoinUI').then(m => ({ default: m.ServerJoinUI })));
const LaunchMenuUI = lazy(() => import('./LaunchMenuUI').then(m => ({ default: m.LaunchMenuUI })));

import { Game } from '../game/Game';
import { networkManager } from '../game/NetworkManager';
import * as THREE from 'three';

export function GameMenus({ game, targetServer, handleStart, setGameKey }: any) {
  const isInventoryOpen = useUI(state => state.isInventoryOpen);
  const setInventoryOpen = useUI(state => state.setInventoryOpen);
  const isChestOpen = useUI(state => state.isChestOpen);
  const setChestOpen = useUI(state => state.setChestOpen);
  const isShopOpen = useUI(state => state.isShopOpen);
  const setShopOpen = useUI(state => state.setShopOpen);
  const isSettingsOpen = useUI(state => state.isSettingsOpen);
  const setSettingsOpen = useUI(state => state.setSettingsOpen);
  const isPauseMenuOpen = useUI(state => state.isPauseMenuOpen);
  const setPauseMenuOpen = useUI(state => state.setPauseMenuOpen);
  const isServerJoinOpen = useUI(state => state.isServerJoinOpen);
  const setServerJoinOpen = useUI(state => state.setServerJoinOpen);
  const isLaunchMenuOpen = useUI(state => state.isLaunchMenuOpen);
  const setLaunchMenuOpen = useUI(state => state.setLaunchMenuOpen);
  const currentNPC = useUI(state => state.currentNPC);
  const setCurrentNPC = useUI(state => state.setCurrentNPC);
  const currentMode = useGameStore(state => state.currentMode);

  if (!game) return null;

  return (
    <>
      {currentMode !== 'hub' && (
        <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
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
      <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <Suspense fallback={null}>
          {isShopOpen && (
            <ShopUI
              npc={currentNPC}
              inventory={game.player.inventory}
              isOpen={isShopOpen}
              onClose={() => setShopOpen(false)}
            />
          )}
          {isSettingsOpen && (
            <SettingsUI 
              isOpen={isSettingsOpen} 
              onClose={() => {
                setSettingsOpen(false);
                setPauseMenuOpen(true);
              }} 
            />
          )}
          {isPauseMenuOpen && (
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
          )}
          {isServerJoinOpen && (
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
          )}
          {isLaunchMenuOpen && (
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
          )}
        </Suspense>
      </div>
    </>
  );
}
