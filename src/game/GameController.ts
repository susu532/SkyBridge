import { Game } from './Game';
import { Inventory, ItemType } from './Inventory';
import { useGameStore } from '../store/gameStore';

interface BaseGameMode {
  tick(delta: number): void;
}

class SkyCastlesMode implements BaseGameMode {
  private game: Game;
  private _wasNight: boolean = false;
  private _autoEquippedTorchFromHotbarSlot: number = -1;

  constructor(game: Game) {
    this.game = game;
  }

  tick(delta: number) {
    const isNightOrRain = Math.sin(this.game.environmentManager.dayTime * Math.PI * 2) <= 0 || this.game.environmentManager.weatherType === 'rain';
    if (isNightOrRain !== this._wasNight) {
      this._wasNight = isNightOrRain;
      if (isNightOrRain) {
        // Find a torch in hotbar
        const inv = this.game.player.inventory;
        if (!inv.slots[Inventory.OFF_HAND_SLOT]) { // Only if off-hand is empty
          for (let i = 0; i < 9; i++) {
            if (inv.slots[i] && inv.slots[i]!.type === ItemType.TORCH) {
              inv.slots[Inventory.OFF_HAND_SLOT] = inv.slots[i];
              inv.slots[i] = null;
              this._autoEquippedTorchFromHotbarSlot = i;
              useGameStore.getState().incrementInventoryVersion();
              window.dispatchEvent(new CustomEvent('updateHotbar'));
              break;
            }
          }
        }
      } else {
        // It just turned day, return torch if we auto-equipped it
        const inv = this.game.player.inventory;
        const offhand = inv.slots[Inventory.OFF_HAND_SLOT];
        if (this._autoEquippedTorchFromHotbarSlot !== -1 && offhand && offhand.type === ItemType.TORCH) {
          if (!inv.slots[this._autoEquippedTorchFromHotbarSlot]) {
            inv.slots[this._autoEquippedTorchFromHotbarSlot] = offhand;
            inv.slots[Inventory.OFF_HAND_SLOT] = null;
            useGameStore.getState().incrementInventoryVersion();
            window.dispatchEvent(new CustomEvent('updateHotbar'));
          } else {
            inv.slots[Inventory.OFF_HAND_SLOT] = null;
            inv.addItem(ItemType.TORCH, offhand.count);
            useGameStore.getState().incrementInventoryVersion();
            window.dispatchEvent(new CustomEvent('updateHotbar'));
          }
        }
        this._autoEquippedTorchFromHotbarSlot = -1;
      }
    }
  }
}

class DefaultMode implements BaseGameMode {
  tick(delta: number) {}
}

export class GameController {
  private game: Game;
  private modes: Record<string, BaseGameMode>;

  constructor(game: Game) {
    this.game = game;
    this.modes = {
       'skycastles': new SkyCastlesMode(game),
    };
  }

  public tick(delta: number, serverName: string) {
    const baseMode = serverName.split('_')[0] || 'hub';
    const mode = this.modes[baseMode] || new DefaultMode();
    mode.tick(delta);
  }
}

