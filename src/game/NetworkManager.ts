import { useGameStore } from '../store/gameStore';
import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { getSecureBackendUrl } from '../utils/security';

export class NetworkManager {
  socket!: Socket;
  serverName: string = 'hub';
  players: Record<string, any> = {};
  blockChanges: Record<string, number> = {};
  private pendingEmits: { event: string, args: any[] }[] = [];
  get id() { return this.socket?.id; }
  private _onInit?: (data: any) => void;
  get onInit() { return this._onInit; }
  set onInit(callback: ((data: any) => void) | undefined) {
    this._onInit = callback;
    if (callback && this.initData) {
      callback(this.initData);
    }
  }
  onPlayerJoined?: (player: any) => void;
  onPlayerMoved?: (player: any) => void;
  onPlayerLeft?: (id: string) => void;
  onPlayerHit?: (data: { id: string, damage: number, knockbackDir: {x: number, y: number, z: number} }) => void;
  onPlayerRespawn?: (data: { id: string, position: {x: number, y: number, z: number} }) => void;
  onSkillUpdate?: (data: { id: string, skill: string, progress: any }) => void;
  onBlockChanged?: (data: {x: number, y: number, z: number, type: number}) => void;
  onChatMessage?: (data: { sender: string, message: string }) => void;
  onItemSpawned?: (data: { id: string, type: number, position: {x: number, y: number, z: number}, velocity?: {x: number, y: number, z: number} }) => void;
  onItemDespawned?: (id: string) => void;
  onMobSpawned?: (mob: any) => void;
  onMobsUpdate?: (mobs: Record<string, any>) => void;
  onMobDespawned?: (id: string) => void;
  onRequestSpawnCheck?: (data: any) => void;
  onMinionSpawned?: (minion: any) => void;
  onMinionDespawned?: (id: string) => void;
  onMinionUpdate?: (data: { id: string, storage: number }) => void;
  onMinionCollected?: (data: { id: string, amount: number, type: number }) => void;
  onTimeUpdate?: (data: { dayTime: number }) => void;
  private initData: any = null;

  resetHandlers() {
    this._onInit = undefined;
    this.onPlayerJoined = undefined;
    this.onPlayerMoved = undefined;
    this.onPlayerLeft = undefined;
    this.onPlayerHit = undefined;
    this.onPlayerRespawn = undefined;
    this.onSkillUpdate = undefined;
    this.onBlockChanged = undefined;
    this.onChatMessage = undefined;
    this.onItemSpawned = undefined;
    this.onItemDespawned = undefined;
    this.onMobSpawned = undefined;
    this.onMobsUpdate = undefined;
    this.onMobDespawned = undefined;
    this.onRequestSpawnCheck = undefined;
    this.onMinionSpawned = undefined;
    this.onMinionDespawned = undefined;
    this.onMinionUpdate = undefined;
    this.onMinionCollected = undefined;
    this.onTimeUpdate = undefined;
  }

  receiveLocalMessage(sender: string, message: string) {
    if (this.onChatMessage) this.onChatMessage({ sender, message });
    useGameStore.getState().addChatMessage(sender, message);
  }

  constructor() {
    this.initMatchmaking();
  }

  async initMatchmaking(modeOverride?: string) {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = modeOverride || urlParams.get('server') || 'hub';
    
    // Immediately update URL to provide instant visual feedback of server transition
    if (modeOverride) {
      window.history.pushState({}, '', `/?server=${mode}`);
    }
    
    try {
      const resp = await fetch(`/api/matchmake?mode=${mode}`);
      const data = await resp.json();
      if (data.serverId) {
        // serverId already starts with / e.g. /hub_1
        this.connect(data.serverId.replace('/', ''));
        window.history.pushState({}, '', `/?server=${data.serverId.replace('/', '')}`);
      } else {
        this.connect(mode + '_1');
        window.history.pushState({}, '', `/?server=${mode}_1`);
      }
    } catch (e) {
      console.error('Matchmaking failed:', e);
      this.connect(mode + '_1');
      window.history.pushState({}, '', `/?server=${mode}_1`);
    }
  }

  public connect(serverName: string) {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
    }
    
    this.initData = null;
    this.players = {};
    this.blockChanges = {};
    this.serverName = serverName;

   const BACKEND_URL = getSecureBackendUrl(import.meta.env.VITE_BACKEND_URL as string);
    this.socket = io(`${BACKEND_URL}/${serverName}`);

    this.socket.on('connect', () => {
      for (const pending of this.pendingEmits) {
        this.socket.emit(pending.event, ...pending.args);
      }
      this.pendingEmits = [];
    });

    this.socket.on('init', (data) => {
      this.initData = data;
      this.players = data.players;
      this.blockChanges = data.blockChanges;
      if (this._onInit) this._onInit(data);
    });

    this.socket.on('itemSpawned', (data) => {
      if (this.onItemSpawned) this.onItemSpawned(data);
    });

    this.socket.on('itemDespawned', (id) => {
      if (this.onItemDespawned) this.onItemDespawned(id);
    });

    this.socket.on('mobSpawned', (data) => {
      if (this.onMobSpawned) this.onMobSpawned(data);
    });

    this.socket.on('mobsUpdate', (updates: Record<string, any[] | ArrayBuffer>) => {
      // Create a modified updates object with Float32Array unpacked
      const unpacked: Record<string, any[]> = {};
      for (const id in updates) {
        const packedData = updates[id];
        const packed = packedData instanceof ArrayBuffer ? new Float32Array(packedData) : packedData as any[];
        unpacked[id] = [packed[0], packed[1], packed[2], packed[3]];
      }
      if (this.onMobsUpdate) this.onMobsUpdate(unpacked);
    });

    this.socket.on('requestSpawnCheck', (data) => {
      if (this.onRequestSpawnCheck) this.onRequestSpawnCheck(data);
    });

    this.socket.on('mobDespawned', (id) => {
      if (this.onMobDespawned) this.onMobDespawned(id);
    });

    this.socket.on('minionSpawned', (data) => {
      if (this.onMinionSpawned) this.onMinionSpawned(data);
    });

    this.socket.on('minionDespawned', (id) => {
      if (this.onMinionDespawned) this.onMinionDespawned(id);
    });

    this.socket.on('minionUpdate', (data) => {
      if (this.onMinionUpdate) this.onMinionUpdate(data);
    });

    this.socket.on('minionCollected', (data) => {
      if (this.onMinionCollected) this.onMinionCollected(data);
    });

    this.socket.on('timeUpdate', (data) => {
      if (this.onTimeUpdate) this.onTimeUpdate(data);
    });

    this.socket.on('playerJoined', (player) => {
      this.players[player.id] = player;
      if (this.onPlayerJoined) this.onPlayerJoined(player);
    });

    this.socket.on('playersUpdate', (updates: Record<string, any[] | ArrayBuffer>) => {
      for (const id in updates) {
        if (id === this.id) continue;
        const packedData = updates[id];
        const packed = packedData instanceof ArrayBuffer ? new Float32Array(packedData) : packedData as any[];
        
        const stateMask = packed[5];
        const player = {
          id: id,
          position: { x: packed[0], y: packed[1], z: packed[2] },
          rotation: { x: packed[3], y: packed[4], z: 0 },
          isFlying: !!(stateMask & 1),
          isSwimming: !!(stateMask & 2),
          isCrouching: !!(stateMask & 4),
          isSprinting: !!(stateMask & 8),
          isSwinging: !!(stateMask & 16),
          isGrounded: !!(stateMask & 32),
          isBlocking: !!(stateMask & 64),
          isGliding: !!(stateMask & 128),
          swingSpeed: packed[6],
          heldItem: packed[7],
          offHandItem: packed[8],
          health: packed[9]
        };

        let isNew = false;
        if (this.players[id]) {
          Object.assign(this.players[id], player);
        } else {
          this.players[id] = player;
          isNew = true;
        }
        
        if (isNew && this.onPlayerJoined) {
          this.onPlayerJoined(player);
        }
        if (this.onPlayerMoved) {
          this.onPlayerMoved(player);
        }
      }
    });

    this.socket.on('playerLeft', (id) => {
      delete this.players[id];
      if (this.onPlayerLeft) this.onPlayerLeft(id);
    });

    this.socket.on('playerDied', (data) => {
      const id = data.id || data; // handle both object with id or string
      if (this.players[id]) {
        delete this.players[id];
      }
      if (this.onPlayerLeft) this.onPlayerLeft(id);
    });

    this.socket.on('batchedPlayerHits', (hits: any[]) => {
      for (const data of hits) {
        if (this.onPlayerHit) this.onPlayerHit(data);
        window.dispatchEvent(new CustomEvent('networkPlayerHit', { detail: data }));
      }
    });

    this.socket.on('batchedMobHits', (hits: any[]) => {
      for (const data of hits) {
        window.dispatchEvent(new CustomEvent('networkMobHit', { detail: data }));
      }
    });

    this.socket.on('playerHit', (data) => {
      if (this.onPlayerHit) this.onPlayerHit(data);
      window.dispatchEvent(new CustomEvent('networkPlayerHit', { detail: data }));
    });

    this.socket.on('mobHit', (data) => {
      window.dispatchEvent(new CustomEvent('networkMobHit', { detail: data }));
    });

    this.socket.on('playerRespawn', (data) => {
      if (this.onPlayerRespawn) this.onPlayerRespawn(data);
      window.dispatchEvent(new CustomEvent('networkPlayerRespawn', { detail: data }));
    });

    this.socket.on('skillUpdate', (data) => {
      if (this.onSkillUpdate) this.onSkillUpdate(data);
    });

    this.socket.on('blockChanged', (data) => {
      const key = `${data.x},${data.y},${data.z}`;
      this.blockChanges[key] = data.type;
      if (this.onBlockChanged) this.onBlockChanged(data);
    });

    this.socket.on('chatMessage', (data) => {
      if (this.onChatMessage) this.onChatMessage(data);
      useGameStore.getState().addChatMessage(data.sender, data.message);
    });
  }

  private _emit(event: string, ...args: any[]) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, ...args);
    } else {
      this.pendingEmits.push({ event, args });
    }
  }

  private _volatile_emit(event: string, ...args: any[]) {
    if (this.socket && this.socket.connected) {
      this.socket.volatile.emit(event, ...args);
    }
  }

  join(position: THREE.Vector3, rotation: THREE.Euler, skinSeed: string, name: string, skills?: any, heldItem: number = 0, offHandItem: number = 0) {
    this._emit('join', {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
      skinSeed,
      name,
      skills,
      heldItem,
      offHandItem
    });
  }

  updateSkills(skill: string, progress: any) {
    this._emit('skillUpdate', { skill, progress });
  }

  move(position: THREE.Vector3, rotation: THREE.Euler) {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);
    view.setFloat32(0, position.x);
    view.setFloat32(4, position.y);
    view.setFloat32(8, position.z);
    view.setFloat32(12, rotation.x);
    view.setFloat32(16, rotation.y);
    
    this._volatile_emit('moveP', buffer);
  }

  updateState(state: any) {
    this._emit('playerState', state);
  }

  setBlock(x: number, y: number, z: number, type: number, force: boolean = false) {
    this._emit('setBlock', { x, y, z, type, force });
  }

  sendChatMessage(message: string) {
    this._emit('chatMessage', message);
  }

  dropItem(type: number, position: {x: number, y: number, z: number}, velocity?: {x: number, y: number, z: number}) {
    this._emit('dropItem', { type, position, velocity });
  }

  pickupItem(id: string) {
    this._emit('pickupItem', id);
  }

  spawnMinion(type: number, position: {x: number, y: number, z: number}) {
    this._emit('spawnMinion', { type, position });
  }

  removeMinion(id: string) {
    this._emit('removeMinion', id);
  }

  collectMinion(id: string) {
    this._emit('collectMinion', id);
  }

  spawnMob(type: string, position: {x: number, y: number, z: number}, level?: number) {
    this._emit('spawnMob', { type, position, level });
  }

  mobHit(id: string, damage: number, knockbackDir: {x: number, y: number, z: number}) {
    this._emit('mobHit', { id, damage, knockbackDir });
  }

  attack(targetId: string, isMob: boolean, knockbackDir: {x: number, y: number, z: number}, isSprinting: boolean) {
    this._emit('attack', { targetId, isMob, knockbackDir, isSprinting });
  }

  requestRespawn() {
    this._emit('requestRespawn');
  }

  playerHit(id: string, damage: number, knockbackDir: {x: number, y: number, z: number}, attackerId: string) {
    this._emit('playerHit', { id, damage, knockbackDir, attackerId });
  }
}

export const networkManager = new NetworkManager();
