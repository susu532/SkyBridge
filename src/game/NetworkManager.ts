import { useGameStore } from "../store/gameStore";
import * as THREE from "three";
import { encodePacketClient, decodePacketClient } from "./WSHelpersClient";
import { encodeRLE, decodeRLE } from "./RLE";
import { getSecureBackendUrl } from '../utils/security';

class FakeClientSocket {
  public connected = false;
  public ws: WebSocket | null = null;
  public handlers: Record<string, Function> = {};
  private emitQueue: { event: string; args: any[] }[] = [];
  public _id = "";
  public reconnectCallback: (() => void) | null = null;
  private isVolatileMode = false;

  constructor(public url: string) {
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';
    
    this.ws.onopen = () => {
      this.connected = true;
      if (this.handlers['connect']) this.handlers['connect']();
      for (const pending of this.emitQueue) {
         this.ws!.send(encodePacketClient(pending.event, pending.args));
      }
      this.emitQueue = [];
    };

    this.ws.onmessage = async (e) => {
      const decoded = await decodePacketClient(e.data);
      if (decoded) {
          if (decoded.event === 'set_id') {
              this._id = decoded.args[0];
          } else if (this.handlers[decoded.event]) {
              this.handlers[decoded.event](...decoded.args);
          }
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      if (this.handlers['disconnect']) this.handlers['disconnect']();
      if (this.reconnectCallback) {
        this.reconnectCallback();
      }
    };
  }

  get id() { return this._id; }

  on(event: string, handler: Function) {
    this.handlers[event] = handler;
  }

  off(event: string, handler?: Function) {
    if (handler && this.handlers[event] === handler) {
       delete this.handlers[event];
    } else if (!handler) {
       delete this.handlers[event];
    }
  }

  emit(event: string, ...args: any[]) {
    if (this.connected && this.ws) {
       this.ws.send(encodePacketClient(event, args));
    } else if (!this.isVolatileMode) {
       this.emitQueue.push({ event, args });
    }
  }

  get volatile() { 
    return {
      emit: (event: string, ...args: any[]) => {
        this.isVolatileMode = true;
        this.emit(event, ...args);
        this.isVolatileMode = false;
      }
    }; 
  }

  disconnect() {
    this.reconnectCallback = null;
    if (this.ws) {
       this.ws.close();
       this.ws = null;
    }
    this.connected = false;
  }

  removeAllListeners() {
    this.handlers = {};
  }
}

export class NetworkManager {
  socket!: FakeClientSocket;
  // ... rest of implementation (using socket as FakeClientSocket)
  serverName: string = "hub";
  players: Record<string, any> = {};
  blockChanges: Record<string, number> = {};
  private pendingEmits: { event: string; args: any[] }[] = [];
  get id() {
    return this.socket?.id;
  }
  private _onInit?: (data: any) => void;
  get onInit() {
    return this._onInit;
  }
  set onInit(callback: ((data: any) => void) | undefined) {
    this._onInit = callback;
    if (callback && this.initData) {
      callback(this.initData);
    }
  }
  onPlayerJoined?: (player: any) => void;
  onPlayerMoved?: (player: any) => void;
  onPlayerLeft?: (id: string) => void;
  onPlayerHit?: (data: {
    id: string;
    damage: number;
    knockbackDir: { x: number; y: number; z: number };
  }) => void;
  onPlayerRespawn?: (data: {
    id: string;
    position: { x: number; y: number; z: number };
    team?: string;
    yaw?: number;
  }) => void;
  onBecomeSpectator?: () => void;
  onSkillUpdate?: (data: { id: string; skill: string; progress: any }) => void;
  onBlockChanged?: (data: {
    x: number;
    y: number;
    z: number;
    type: number;
  }) => void;
  onChatMessage?: (data: { sender: string; message: string }) => void;
  onItemSpawned?: (data: {
    id: string;
    type: number;
    position: { x: number; y: number; z: number };
    velocity?: { x: number; y: number; z: number };
  }) => void;
  onItemDespawned?: (id: string) => void;
  onEntitiesReset?: (data: {
    mobs: Record<string, any>;
    droppedItems: Record<string, any>;
  }) => void;
  onMobSpawned?: (mob: any) => void;
  onMobsUpdate?: (mobs: Record<string, any>) => void;
  onMobDespawned?: (id: string) => void;
  onRequestSpawnCheck?: (data: any) => void;
  onMinionSpawned?: (minion: any) => void;
  onMinionDespawned?: (id: string) => void;
  onMinionUpdate?: (data: { id: string; storage: number }) => void;
  onMinionCollected?: (data: {
    id: string;
    amount: number;
    type: number;
  }) => void;
  onTimeUpdate?: (data: { dayTime: number }) => void;
  private initData: any = null;
  private reconnectAttempt = 0;

  resetHandlers() {
    this._onInit = undefined;
    this.onPlayerJoined = undefined;
    this.onPlayerMoved = undefined;
    this.onPlayerLeft = undefined;
    this.onPlayerHit = undefined;
    this.onPlayerRespawn = undefined;
    this.onBecomeSpectator = undefined;
    this.onSkillUpdate = undefined;
    this.onBlockChanged = undefined;
    this.onChatMessage = undefined;
    this.onItemSpawned = undefined;
    this.onItemDespawned = undefined;
    this.onEntitiesReset = undefined;
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

  async initMatchmaking(modeOverride?: string, isReconnect = false) {
    if (!isReconnect) {
      useGameStore.getState().setIsMapLoading(true);
      this.reconnectAttempt = 0;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const mode = modeOverride || urlParams.get("server") || "hub";

    // Immediately update URL to provide instant visual feedback of server transition
    if (modeOverride) {
      window.history.pushState({}, "", `?server=${mode}`);
    }

    try {
      const baseUrl = getSecureBackendUrl(import.meta.env.VITE_BACKEND_URL as string);
      const resp = await fetch(`${baseUrl}/api/matchmake?mode=${mode}`);
      const data = await resp.json();
      if (data.serverId) {
        // serverId already starts with / e.g. /hub_1
        this.connect(data.serverId.replace("/", ""));
        window.history.pushState(
          {},
          "",
          `?server=${data.serverId.replace("/", "")}`,
        );
      } else {
        const connectMode = mode.includes('_') ? mode : `${mode}_1`;
        this.connect(connectMode);
        window.history.pushState({}, "", `?server=${connectMode}`);
      }
      this.reconnectAttempt = 0; // Reset on success
    } catch (e) {
      console.error("Matchmaking failed:", e);
      if (isReconnect && this.reconnectAttempt < 5) {
        setTimeout(() => {
          this.reconnectAttempt++;
          this.initMatchmaking(modeOverride, true);
        }, Math.min(1000 * Math.pow(2, this.reconnectAttempt), 15000));
      } else {
        const connectMode = mode.includes('_') ? mode : `${mode}_1`;
        this.connect(connectMode);
        window.history.pushState({}, "", `?server=${connectMode}`);
      }
    }
  }

  private applyPlayerUpdate(id: string, packed: Float32Array | any[]) {
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
      isInvulnerable: !!(stateMask & 256),
      swingSpeed: packed[6],
      heldItem: packed[7],
      offHandItem: packed[8],
      defense: packed[9],
      health: packed[10],
    };

    let isNew = false;
    if (this.players[id]) {
      Object.assign(this.players[id], player);
    } else {
      this.players[id] = player as any;
      isNew = true;
      this.socket.emit("requestPlayerInfo", id);
    }

    if (this.onPlayerMoved) {
      this.onPlayerMoved(this.players[id]);
    }
  }

  public connect(serverName: string) {
    useGameStore.getState().setIsMapLoading(true);
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
    }

    this.initData = null;
    this.players = {};
    this.blockChanges = {};
    this.serverName = serverName;

    useGameStore.getState().setCurrentMode(serverName.split("_")[0] || "hub");
    useGameStore.getState().setServerId(serverName);

    const backendUrl = getSecureBackendUrl(import.meta.env.VITE_BACKEND_URL as string);
    const wsUrl = backendUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    this.socket = new FakeClientSocket(`${wsUrl}/ws/${serverName}`);
    
    this.socket.reconnectCallback = () => {
      console.log("WebSocket disconnected. Attempting to reconnect...");
      setTimeout(() => {
        this.initMatchmaking(this.serverName, true);
      }, Math.min(1000 * Math.pow(2, this.reconnectAttempt), 15000));
    };

    this.socket.on("connect", () => {
      for (const pending of this.pendingEmits) {
        this.socket.emit(pending.event, ...pending.args);
      }
      this.pendingEmits = [];
    });

    this.socket.on("init", (data) => {
      if (!data) return;
      this.initData = data;
      this.players = data.players || {};
      
      useGameStore.getState().setGameStartTime(data.gameStartTime || 0);

      // Initialize leaderboard
      for (const id in this.players) {
        const p = this.players[id];
        useGameStore.getState().setLeaderboardPlayer(id, p.name || 'Unknown', p.team, p.kills || 0, p.deaths || 0);
      }

      if (this._onInit) this._onInit(data);
    });

    this.socket.on("itemSpawned", (data) => {
      if (this.onItemSpawned) this.onItemSpawned(data);
    });

    this.socket.on("itemDespawned", (id) => {
      if (this.onItemDespawned) this.onItemDespawned(id);
    });

    this.socket.on("itemAcquired", (data) => {
      window.dispatchEvent(new CustomEvent("itemAcquired", { detail: data }));
    });

    this.socket.on("entitiesReset", (data) => {
      if (data.gameStartTime) {
        useGameStore.getState().setGameStartTime(data.gameStartTime);
      }
      (window as any)["looted_mid_chest_red"] = false;
      (window as any)["looted_mid_chest_blue"] = false;
      if (this.onEntitiesReset) this.onEntitiesReset(data);
    });

    this.socket.on("mobSpawned", (data) => {
      if (this.onMobSpawned) this.onMobSpawned(data);
    });

    this.socket.on(
      "mobsUpdate",
      (updates: Record<string, any[] | ArrayBuffer>) => {
        // legacy json fallback
        const unpacked: Record<string, any[]> = {};
        for (const id in updates) {
          const packedData = updates[id];
          const packed =
            packedData instanceof ArrayBuffer
              ? new Float32Array(packedData)
              : (packedData as any[]);
          unpacked[id] = [packed[0], packed[1], packed[2], packed[3]];
        }
        if (this.onMobsUpdate) this.onMobsUpdate(unpacked);
      },
    );

    this.socket.on("skyCastlesSync", (data) => {
      (window as any).latestSkyCastlesSync = data;
      window.dispatchEvent(new CustomEvent("skyCastlesSync", { detail: data }));
    });

    this.socket.on("requestSpawnCheck", (data) => {
      if (this.onRequestSpawnCheck) this.onRequestSpawnCheck(data);
    });

    this.socket.on("mobDespawned", (id) => {
      if (this.onMobDespawned) this.onMobDespawned(id);
    });

    this.socket.on("minionSpawned", (data) => {
      if (this.onMinionSpawned) this.onMinionSpawned(data);
    });

    this.socket.on("minionDespawned", (id) => {
      if (this.onMinionDespawned) this.onMinionDespawned(id);
    });

    this.socket.on("minionUpdate", (data) => {
      if (this.onMinionUpdate) this.onMinionUpdate(data);
    });

    this.socket.on("minionCollected", (data) => {
      if (this.onMinionCollected) this.onMinionCollected(data);
    });

    this.socket.on("timeUpdate", (data) => {
      if (this.onTimeUpdate) this.onTimeUpdate(data);
    });

    this.socket.on("playerJoined", (player) => {
      if (!player || !player.id) return;
      let isBrandNew = !this.players[player.id];
      if (this.players[player.id]) {
        // We already have their movement state, but we need their name/skin
        Object.assign(this.players[player.id], player);
      } else {
        this.players[player.id] = player;
      }
      useGameStore.getState().setLeaderboardPlayer(player.id, player.name || 'Unknown', player.team, player.kills || 0, player.deaths || 0);
      if (this.onPlayerJoined) this.onPlayerJoined(this.players[player.id]);
    });

    this.socket.on("playersUpdate", (updates: Record<string, any[] | ArrayBuffer>) => {
      // Legacy JSON support
      for (const id in updates) {
        if (id === this.id) continue;
        const packedData = updates[id];
        const packed = packedData instanceof ArrayBuffer ? new Float32Array(packedData) : (packedData as any[]);
        this.applyPlayerUpdate(id, packed);
      }
    });

    this.socket.on("playersUpdateB", (buffer: ArrayBuffer) => {
      const view = new DataView(buffer);
      const buf8 = new Uint8Array(buffer);
      let offset = 0;
      const count = view.getUint16(offset, true); offset += 2;
      
      const decoder = new TextDecoder('utf8');
      for (let i = 0; i < count; i++) {
        const idLen = buf8[offset++];
        const idBytes = buf8.subarray(offset, offset + idLen);
        const id = decoder.decode(idBytes);
        offset += idLen;
        
        let floatOffset = offset;
        if (floatOffset % 4 !== 0) {
            floatOffset += 4 - (floatOffset % 4);
        }
        offset = floatOffset;
        
        const packed = new Float32Array(buffer, offset, 11);
        offset += 11 * 4;
        
        if (id !== this.id) {
           this.applyPlayerUpdate(id, packed);
        }
      }
    });

    this.socket.on("mobsUpdateB", (buffer: ArrayBuffer) => {
      const view = new DataView(buffer);
      const buf8 = new Uint8Array(buffer);
      let offset = 0;
      const count = view.getUint16(offset, true); offset += 2;
      
      const decoder = new TextDecoder('utf8');
      const unpacked: Record<string, any[]> = {};
      
      for (let i = 0; i < count; i++) {
        const idLen = buf8[offset++];
        const idBytes = buf8.subarray(offset, offset + idLen);
        const id = decoder.decode(idBytes);
        offset += idLen;
        
        let floatOffset = offset;
        if (floatOffset % 4 !== 0) {
            floatOffset += 4 - (floatOffset % 4);
        }
        offset = floatOffset;
        
        const packed = new Float32Array(buffer, offset, 4);
        offset += 4 * 4;
        
        unpacked[id] = [packed[0], packed[1], packed[2], packed[3]];
      }
      if (this.onMobsUpdate) this.onMobsUpdate(unpacked);
    });

    this.socket.on("playerLeft", (id) => {
      delete this.players[id];
      useGameStore.getState().removeLeaderboardPlayer(id);
      if (this.onPlayerLeft) this.onPlayerLeft(id);
    });

    this.socket.on("playerStatsUpdate", (data) => {
      if (!data || !data.id) return;
      useGameStore.getState().updateLeaderboardStats(data.id, data.kills, data.deaths);
    });

    this.socket.on("playerDied", (data) => {
      const id = data.id || data; // handle both object with id or string
      window.dispatchEvent(
        new CustomEvent("networkPlayerDied", { detail: { id } }),
      );
    });

    this.socket.on("playerStatus", (data) => {
      window.dispatchEvent(
        new CustomEvent("networkPlayerStatus", { detail: data }),
      );
    });

    this.socket.on("skycoinsRewarded", (data) => {
      window.dispatchEvent(
        new CustomEvent("skycoinsRewarded", { detail: data }),
      );
    });

    this.socket.on("batchedPlayerHits", (hits: any[]) => {
      for (const data of hits) {
        if (this.onPlayerHit) this.onPlayerHit(data);
        window.dispatchEvent(
          new CustomEvent("networkPlayerHit", { detail: data }),
        );
      }
    });

    this.socket.on("batchedMobHits", (hits: any[]) => {
      for (const data of hits) {
        window.dispatchEvent(
          new CustomEvent("networkMobHit", { detail: data }),
        );
      }
    });

    this.socket.on("playerHit", (data) => {
      if (this.onPlayerHit) this.onPlayerHit(data);
      window.dispatchEvent(
        new CustomEvent("networkPlayerHit", { detail: data }),
      );
    });

    this.socket.on("mobHit", (data) => {
      window.dispatchEvent(new CustomEvent("networkMobHit", { detail: data }));
    });

    this.socket.on("becomeSpectator", () => {
      if (this.onBecomeSpectator) this.onBecomeSpectator();
      window.dispatchEvent(new CustomEvent("becomeSpectator"));
    });

    this.socket.on("playerRespawn", (data) => {
      if (this.onPlayerRespawn) this.onPlayerRespawn(data);
      window.dispatchEvent(
        new CustomEvent("networkPlayerRespawn", { detail: data }),
      );
    });

    this.socket.on("skillUpdate", (data) => {
      if (this.onSkillUpdate) this.onSkillUpdate(data);
    });

    this.socket.on("blockChanged", (data) => {
      if (this.onBlockChanged) this.onBlockChanged(data);
    });

    this.socket.on("chatMessage", (data) => {
      if (this.onChatMessage) this.onChatMessage(data);
      useGameStore.getState().addChatMessage(data.sender, data.message, data.team);
    });

    this.socket.on("switchServer", (mode) => {
      this.initMatchmaking(mode);
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

  join(
    position: THREE.Vector3,
    rotation: THREE.Euler,
    skinSeed: string,
    name: string,
    skills?: any,
    heldItem: number = 0,
    offHandItem: number = 0,
  ) {
    this._emit("join", {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
      skinSeed,
      name,
      skills,
      heldItem,
      offHandItem,
    });
  }

  updateSkills(skill: string, progress: any) {
    this._emit("skillUpdate", { skill, progress });
  }

  move(position: THREE.Vector3, rotation: THREE.Euler) {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);
    view.setFloat32(0, position.x);
    view.setFloat32(4, position.y);
    view.setFloat32(8, position.z);
    view.setFloat32(12, rotation.x);
    view.setFloat32(16, rotation.y);

    this._volatile_emit("moveP", buffer);
  }

  updateState(state: any) {
    this._emit("playerState", state);
  }

  updateProfile(profile: { name: string; skinSeed?: string }) {
    this._emit("updateProfile", profile);
  }

  setBlock(
    x: number,
    y: number,
    z: number,
    type: number,
    force: boolean = false,
  ) {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    this.blockChanges[key] = type;
    this._emit("setBlock", { x, y, z, type, force });
  }

  sendChatMessage(message: string) {
    this._emit("chatMessage", message);
  }

  dropItem(
    type: number,
    position: { x: number; y: number; z: number },
    velocity?: { x: number; y: number; z: number },
  ) {
    this._emit("dropItem", { type, position, velocity });
  }

  pickupItem(id: string) {
    this._emit("pickupItem", id);
  }

  spawnMinion(type: number, position: { x: number; y: number; z: number }) {
    this._emit("spawnMinion", { type, position });
  }

  async requestChunkChanges(cx: number, cz: number): Promise<Uint16Array | null> {
    if (!this.socket) return null;
    return new Promise((resolve) => {
      const handler = (data: any) => {
        if (data.cx === cx && data.cz === cz) {
          this.socket.off("chunkData", handler);
          if (data.patch) {
             const out = new Uint16Array(16*256*16);
             out.fill(65535);
             for(let i=0; i<data.patch.length; i+=2) {
                 out[data.patch[i]] = data.patch[i+1];
             }
             resolve(out);
          } else if (data.data) {
             const compressed = new Uint16Array(data.data);
             const out = new Uint16Array(16*256*16);
             decodeRLE(compressed, out);
             resolve(out);
          } else {
             resolve(null);
          }
        }
      };
      this.socket.on("chunkData", handler);
      this._emit("requestChunkChanges", { cx, cz });
      
      // Auto resolve if timeout
      setTimeout(() => {
        this.socket.off("chunkData", handler);
        resolve(null);
      }, 5000);
    });
  }

  removeMinion(id: string) {
    this._emit("removeMinion", id);
  }

  collectMinion(id: string) {
    this._emit("collectMinion", id);
  }

  spawnMob(
    type: string,
    position: { x: number; y: number; z: number },
    level?: number,
    team?: string,
  ) {
    this._emit("spawnMob", { type, position, level, team });
  }

  mobHit(
    id: string,
    damage: number,
    knockbackDir: { x: number; y: number; z: number },
  ) {
    this._emit("mobHit", { id, damage, knockbackDir });
  }

  attack(
    targetId: string,
    isMob: boolean,
    knockbackDir: { x: number; y: number; z: number },
    isSprinting: boolean,
    damage?: number,
    isCrit?: boolean,
  ) {
    this._emit("attack", {
      targetId,
      isMob,
      knockbackDir,
      isSprinting,
      damage,
      isCrit,
    });
  }

  requestRespawn() {
    this._emit("requestRespawn");
  }

  playerHit(
    id: string,
    damage: number,
    knockbackDir: { x: number; y: number; z: number },
    attackerId: string,
  ) {
    this._emit("playerHit", { id, damage, knockbackDir, attackerId });
  }
}

export const networkManager = new NetworkManager();
