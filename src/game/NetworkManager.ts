import { io, Socket } from "socket.io-client";
import * as THREE from "three";

export class NetworkManager {
  socket!: Socket;
  serverName: string = "hub";
  players: Record<string, any> = {};
  blockChanges: Record<string, number> = {};
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
  }) => void;
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
    window.dispatchEvent(
      new CustomEvent("chatMessage", { detail: { sender, message } }),
    );
  }

  constructor() {
    const urlParams = new URLSearchParams(window.location.search);
    const serverName = urlParams.get("server") || "hub";
    this.connect(serverName);
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

    const backendUrl =
      import.meta.env.VITE_BACKEND_URL || window.location.origin;
    this.socket = io(backendUrl, {
      path: `/${serverName}`,
    });

    this.socket.on("init", (data) => {
      this.initData = data;
      this.players = data.players;
      this.blockChanges = data.blockChanges;
      if (this._onInit) this._onInit(data);
    });

    this.socket.on("itemSpawned", (data) => {
      if (this.onItemSpawned) this.onItemSpawned(data);
    });

    this.socket.on("itemDespawned", (id) => {
      if (this.onItemDespawned) this.onItemDespawned(id);
    });

    this.socket.on("mobSpawned", (data) => {
      if (this.onMobSpawned) this.onMobSpawned(data);
    });

    this.socket.on("mobsUpdate", (updates) => {
      if (this.onMobsUpdate) this.onMobsUpdate(updates);
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
      this.players[player.id] = player;
      if (this.onPlayerJoined) this.onPlayerJoined(player);
      window.dispatchEvent(
        new CustomEvent("networkPlayerJoined", { detail: player }),
      );
    });

    this.socket.on("playersUpdate", (updates: Record<string, any>) => {
      for (const id in updates) {
        if (id === this.socket.id) continue;
        const player = updates[id];
        let isNew = false;
        if (this.players[id]) {
          Object.assign(this.players[id], player);
        } else {
          this.players[id] = player;
          isNew = true;
        }

        if (isNew && this.onPlayerJoined) {
          this.onPlayerJoined(player);
          window.dispatchEvent(
            new CustomEvent("networkPlayerJoined", { detail: player }),
          );
        }
        if (this.onPlayerMoved) {
          this.onPlayerMoved(player);
        }
        window.dispatchEvent(
          new CustomEvent("networkPlayerMoved", { detail: player }),
        );
      }
    });

    this.socket.on("playerLeft", (id) => {
      delete this.players[id];
      if (this.onPlayerLeft) this.onPlayerLeft(id);
      window.dispatchEvent(
        new CustomEvent("networkPlayerLeft", { detail: { id } }),
      );
    });

    this.socket.on("playerHit", (data) => {
      if (this.onPlayerHit) this.onPlayerHit(data);
      window.dispatchEvent(
        new CustomEvent("networkPlayerHit", { detail: data }),
      );
    });

    this.socket.on("playerRespawn", (data) => {
      if (this.onPlayerRespawn) this.onPlayerRespawn(data);
      window.dispatchEvent(
        new CustomEvent("networkPlayerRespawn", { detail: data }),
      );
    });

    this.socket.on("skillUpdate", (data) => {
      if (this.onSkillUpdate) this.onSkillUpdate(data);
      window.dispatchEvent(
        new CustomEvent("networkSkillUpdate", { detail: data }),
      );
    });

    this.socket.on("blockChanged", (data) => {
      const key = `${data.x},${data.y},${data.z}`;
      this.blockChanges[key] = data.type;
      if (this.onBlockChanged) this.onBlockChanged(data);
    });

    this.socket.on("chatMessage", (data) => {
      if (this.onChatMessage) this.onChatMessage(data);
      window.dispatchEvent(new CustomEvent("chatMessage", { detail: data }));
    });
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
    this.socket.emit("join", {
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
    this.socket.emit("skillUpdate", { skill, progress });
  }

  move(position: THREE.Vector3, rotation: THREE.Euler, state: any) {
    this.socket.emit("move", {
      position: {
        x: Math.round(position.x * 100) / 100,
        y: Math.round(position.y * 100) / 100,
        z: Math.round(position.z * 100) / 100,
      },
      rotation: {
        x: Math.round(rotation.x * 100) / 100,
        y: Math.round(rotation.y * 100) / 100,
        z: Math.round(rotation.z * 100) / 100,
      },
      ...state,
    });
  }

  setBlock(
    x: number,
    y: number,
    z: number,
    type: number,
    force: boolean = false,
  ) {
    this.socket.emit("setBlock", { x, y, z, type, force });
  }

  sendChatMessage(message: string) {
    this.socket.emit("chatMessage", message);
  }

  dropItem(
    type: number,
    position: { x: number; y: number; z: number },
    velocity?: { x: number; y: number; z: number },
  ) {
    this.socket.emit("dropItem", { type, position, velocity });
  }

  pickupItem(id: string) {
    this.socket.emit("pickupItem", id);
  }

  spawnMinion(type: number, position: { x: number; y: number; z: number }) {
    this.socket.emit("spawnMinion", { type, position });
  }

  removeMinion(id: string) {
    this.socket.emit("removeMinion", id);
  }

  collectMinion(id: string) {
    this.socket.emit("collectMinion", id);
  }

  spawnMob(
    type: string,
    position: { x: number; y: number; z: number },
    level?: number,
  ) {
    this.socket.emit("spawnMob", { type, position, level });
  }

  mobHit(
    id: string,
    damage: number,
    knockbackDir: { x: number; y: number; z: number },
  ) {
    this.socket.emit("mobHit", { id, damage, knockbackDir });
  }

  attack(
    targetId: string,
    isMob: boolean,
    knockbackDir: { x: number; y: number; z: number },
    isSprinting: boolean,
  ) {
    this.socket.emit("attack", { targetId, isMob, knockbackDir, isSprinting });
  }
}

export const networkManager = new NetworkManager();
