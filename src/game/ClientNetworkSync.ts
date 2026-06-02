import { networkManager } from "./NetworkManager";
import { Game } from "./Game";
import { skyBridgeManager } from "./SkyBridgeManager";
import { useGameStore } from "../store/gameStore";
import { useUIStore } from "../store/uiStore";
import { settingsManager } from "./Settings";
import { getRandomCutePlayerName } from "./CuteNames";
import { audioManager } from "./AudioManager";
import { isAnyTorch, isTransparent, BLOCK } from "./TextureAtlas";
import { IGameStateData, IPlayerUpdate, ISpawnParams } from "../types/shared";
import * as THREE from "three";

export class ClientNetworkSync {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
    this.registerHandlers();
  }

  private registerHandlers() {
    // Network setup
    networkManager.onInit = (data: IGameStateData) => {
      const urlParams = new URLSearchParams(window.location.search);
      const serverName = urlParams.get("server") || "dungeondelver";

      this.game.player.hasReceivedInitialRespawn = false;
      useGameStore.getState().setIsMapLoading(true);

      // Clear the world chunks to prevent terrain bleeding between domains
      this.game.world.reset(serverName);

      // The world generation routine now automatically checks networkManager.blockChanges
      // preventing far-chunks from dismissing updates before they generate.
      // Any chunks already in frustum will be flagged to rebuild.
      this.game.world.rebuildAllChunks();

      // Clear out all previous entities before processing the newly arrived ones
      this.game.entityManager.clearEntities();

      const modeWithoutNum = serverName.split("_")[0];
      if (modeWithoutNum === "skycastles") {
        this.game.player.setupSkyCastlesInventory();
        useGameStore.getState().setSkycoins(500);
      } else if (modeWithoutNum === "dungeondelver") {
        this.game.player.setupDungeonDelverInventory();
      } else if (modeWithoutNum === "voidtrail") {
        this.game.player.setupVoidTrailInventory();
      } else if (modeWithoutNum === "skybridge") {
        // If skybridge has a setup, do it, but for now just leave it or clear it.
        // Skybridge usually gives you starting items? We can just clear it.
        this.game.player.inventory.clear();
      } else {
        this.game.player.inventory.clear();
      }

      // Clear team immediately to prevent bleeding armor state until explicit assignment
      this.game.player.team = undefined;
      this.game.player.renderer.updateTeam(undefined);

      if (!this.game.world.isHub) {
        // Load local skills if they exist, otherwise use server skills
        let savedSkills = null;
        try {
          savedSkills = localStorage.getItem("skyBridge_skills");
        } catch (e) {
          console.warn("Failed to access localStorage for skills", e);
        }

        if (savedSkills) {
          skyBridgeManager.setSkills(JSON.parse(savedSkills));
        } else if (
          networkManager.id &&
          data.players?.[networkManager.id]?.skills
        ) {
          skyBridgeManager.setSkills(data.players[networkManager.id].skills);
        }
      } else {
        // Ensure SkyBridge state is blank in the hub
        skyBridgeManager.reset();
      }

      // Add existing players
      const playersMap = data?.players || {};
      for (const id in playersMap) {
        if (id === networkManager.id) {
          const myData = playersMap[id];
          this.game.player.team = myData.team || null;
          this.game.player.renderer.updateTeam(this.game.player.team);
          useGameStore.getState().setPlayerTeam(this.game.player.team);

          this.game.player.isSpectator = myData.isSpectator || false;
          this.game.player.isDead = myData.isDead || false;
          if (this.game.player.isSpectator) {
            this.game.player.isFlying = true;
          } else if (!this.game.world.isHub) {
            this.game.player.isFlying = false;
          }
        } else {
          this.game.entityManager.addRemotePlayer(
            id,
            playersMap[id].skinSeed || "",
            playersMap[id].name || "Player",
            playersMap[id].team,
          );
          this.game.entityManager.updateRemotePlayer(id, playersMap[id] as any);
          const rp = this.game.entityManager.remotePlayers.get(id);
          if (rp) {
            rp.isDead = playersMap[id].isDead || false;
            rp.isSpectator = playersMap[id].isSpectator || false;
          }
        }
      }
      // Add existing mobs
      if (data.mobs) {
        for (const id in data.mobs) {
          const mobData = data.mobs[id];
          if (mobData.type === "Sheep" && false) continue; // Sample placeholder or just remove if cleanup
          const pos = Game._tempVec.set(
            mobData.position.x,
            mobData.position.y,
            mobData.position.z,
          );
          const mob = this.game.entityManager.createMob(
            mobData.id,
            pos,
            mobData.level || 1,
            mobData.type as any,
            this.game.entityManager.textureAtlas,
            mobData.team,
          );
          if (mobData.health !== undefined) mob.health = mobData.health;
          if (mobData.maxHealth !== undefined)
            mob.maxHealth = mobData.maxHealth;
          if (mobData.scale) {
            mob.group.scale.set(mobData.scale, mobData.scale, mobData.scale);
          }
          this.game.entityManager.addMob(mob);
        }
      }
      // Add existing minions
      if (data.minions) {
        for (const id in data.minions) {
          const minionData = data.minions[id];
          const pos = Game._tempVec.set(
            minionData.position.x,
            minionData.position.y,
            minionData.position.z,
          );
          this.game.entityManager.addMinionLocally(
            minionData.id,
            minionData.type,
            pos,
          );
        }
      }
      // Add existing dropped items
      if (data.droppedItems) {
        for (const id in data.droppedItems) {
          const itemData = data.droppedItems[id];
          const pos = Game._tempVec.set(
            itemData.position.x,
            itemData.position.y,
            itemData.position.z,
          );
          const vel = itemData.velocity
            ? Game._tempVec2.set(
                itemData.velocity.x,
                itemData.velocity.y,
                itemData.velocity.z,
              )
            : undefined;
          this.game.entityManager.addDroppedItem(
            itemData.id,
            itemData.type,
            pos,
            vel,
          );
        }
      }

      // Add existing NPCs
      if (data.npcs) {
        for (const npcData of data.npcs) {
          this.game.entityManager.addNPCFromData(npcData);
        }
      }

      // Sync time
      if (data.dayTime !== undefined) {
        this.game.environmentManager.dayTime = data.dayTime;
      }

      // Join the game
      const cameraEuler = new THREE.Euler(0, 0, 0, "YXZ");
      cameraEuler.setFromQuaternion(this.game.camera.quaternion);

      // Persist skin
      let mySkinSeed = null;
      try {
        mySkinSeed = localStorage.getItem("skyBridge_skin_seed");
        if (!mySkinSeed) {
          mySkinSeed = "player_" + Math.random().toString(36).substring(7);
          localStorage.setItem("skyBridge_skin_seed", mySkinSeed);
        }
      } catch (e) {
        console.warn("Failed to access localStorage for player info", e);
        if (!mySkinSeed)
          mySkinSeed = "player_" + Math.random().toString(36).substring(7);
      }

      const joinPos = Game._tempVec.set(
        this.game.player.position.x,
        this.game.player.position.y - 1.6,
        this.game.player.position.z,
      );

      const myName =
        settingsManager.getSettings().username ||
        getRandomCutePlayerName();

      networkManager.join(
        joinPos,
        cameraEuler,
        mySkinSeed,
        myName,
        skyBridgeManager.skills,
        this.game.player.inventory.slots[this.game.player.hotbarIndex]?.type ||
          0,
      );

      // Update local player skin
      this.game.player.updateSkin(mySkinSeed);
    };

    networkManager.onPlayerJoined = (player: IPlayerUpdate) => {
      if (player.id !== networkManager.id) {
        this.game.entityManager.addRemotePlayer(
          player.id,
          player.skinSeed || "",
          player.name || "Player",
          player.team,
        );
        const rp = this.game.entityManager.remotePlayers.get(player.id);
        if (rp) {
          rp.isDead = player.isDead || false;
          rp.isSpectator = player.isSpectator || false;
          rp.health = player.health || 100;
        }
      }
    };

    networkManager.onPlayerMoved = (player: IPlayerUpdate) => {
      if (player.id !== networkManager.id) {
        this.game.entityManager.updateRemotePlayer(player.id, player as any);
      }
    };

    networkManager.onPlayerLeft = (id: string) => {
      this.game.entityManager.removeRemotePlayer(id);
    };

    networkManager.onBlockChanged = (data) => {
      this.game.world.setBlock(data.x, data.y, data.z, data.type, false);
      const pos = Game._tempVec.set(data.x + 0.5, data.y + 0.5, data.z + 0.5);
      if (data.type === 0) {
        audioManager.playPositional(
          "break",
          pos,
          0.4,
          0.8 + Math.random() * 0.4,
          20,
        );
        window.dispatchEvent(
          new CustomEvent("spawnParticles", {
            detail: { pos: pos.clone(), type: 1 }, // Use a generic block type for remote break particles right now
          }),
        );
      } else {
        audioManager.playPositional(
          "place",
          pos,
          0.6,
          0.9 + Math.random() * 0.2,
          20,
        );
      }
    };

    networkManager.onItemSpawned = (data) => {
      const pos = Game._tempVec.set(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      const vel = data.velocity
        ? Game._tempVec2.set(data.velocity.x, data.velocity.y, data.velocity.z)
        : undefined;
      this.game.entityManager.addDroppedItem(
        data.id,
        data.type as any,
        pos,
        vel,
      );
    };

    networkManager.onItemDespawned = (id) => {
      this.game.entityManager.removeDroppedItem(id);
    };

    networkManager.onRequestSpawnCheck = (data: ISpawnParams) => {
      const isNight =
        Math.sin(this.game.environmentManager.dayTime * Math.PI * 2) <= 0;

      // 1. Check for player placed/natural light sources nearby (sphere radius 7)
      let nearLightSource = false;
      const radius = 7;

      const px = Math.floor(data.x);
      const py = Math.floor(data.y);
      const pz = Math.floor(data.z);

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (dx * dx + dy * dy + dz * dz <= radius * radius) {
              const block = this.game.world.getBlock(px + dx, py + dy, pz + dz);
              if (
                block === BLOCK.GLOWSTONE ||
                block === BLOCK.LAVA ||
                isAnyTorch(block)
              ) {
                nearLightSource = true;
                break;
              }
            }
          }
          if (nearLightSource) break;
        }
        if (nearLightSource) break;
      }

      if (nearLightSource) return; // Too bright from nearby light-emitting blocks

      // 2. Check sunlight exposure (raycast straight up)
      let isExposed = true;
      const maxHeight = 11; // CHUNK_HEIGHT (16) + WORLD_Y_OFFSET (-5)
      for (let y = py + 1; y < maxHeight; y++) {
        const block = this.game.world.getBlock(px, y, pz);
        if (block !== 0 && !isTransparent(block)) {
          // Consider non-transparent blocks as occluding
          isExposed = false;
          break;
        }
      }

      // If it's daytime and exposed to the sky, don't spawn hostile mobs!
      if (!isNight && isExposed) return;

      // Spawn allowed!
      networkManager.spawnMob(
        data.type,
        { x: data.x, y: data.y, z: data.z },
        data.level,
      );
    };

    networkManager.onMinionCollected = (data) => {
      this.game.player.inventory.addItem(data.type, data.amount);
      useGameStore
        .getState()
        .addMessage(`Collected ${data.amount}x items from minion!`, "#55FF55");
    };

    networkManager.onTimeUpdate = (data) => {
      // Smoothly interpolate or just set
      // For now, just set to ensure perfect sync
      this.game.environmentManager.dayTime = data.dayTime;
    };

    networkManager.onEntitiesReset = (data: {
      mobs: Record<string, any>;
      droppedItems: Record<string, any>;
      gameStartTime?: number;
    }) => {
      useUIStore.getState().forceCloseAllMenus();
      useGameStore.getState().setIsMapLoading(true);
      this.game.player.hasReceivedInitialRespawn = false;
      this.game.entityManager.clearEntities();
      this.game.world.reset(this.game.currentMode);
      useGameStore.getState().clearChatMessages();
      const modeWithoutNum = this.game.currentMode.split("_")[0];
      if (modeWithoutNum === "skycastles") {
        this.game.player.setupSkyCastlesInventory();
        useGameStore.getState().setSkycoins(500);
        skyBridgeManager.reset();
      } else if (modeWithoutNum === "dungeondelver") {
        this.game.player.setupDungeonDelverInventory();
      } else if (modeWithoutNum === "voidtrail") {
        this.game.player.setupVoidTrailInventory();
      } else {
        this.game.player.inventory.clear();
      }
      if (data.mobs) {
        for (const id in data.mobs) {
          const mobData = data.mobs[id];
          // mobData.type check removed
          const pos = Game._tempVec.set(
            mobData.position.x,
            mobData.position.y,
            mobData.position.z,
          );
          const mob = this.game.entityManager.createMob(
            mobData.id,
            pos,
            mobData.level || 1,
            mobData.type as any,
            this.game.entityManager.textureAtlas,
            mobData.team,
          );
          if (mobData.health !== undefined) mob.health = mobData.health;
          if (mobData.maxHealth !== undefined)
            mob.maxHealth = mobData.maxHealth;
          if (mobData.scale)
            mob.group.scale.set(mobData.scale, mobData.scale, mobData.scale);
          this.game.entityManager.addMob(mob);
        }
      }
    };

    // Sync skills when they change
    skyBridgeManager.onSkillChange = (skill, progress) => {
      if (!this.game.world.isHub) {
        networkManager.updateSkills(skill, progress);
        try {
          localStorage.setItem(
            "skyBridge_skills",
            JSON.stringify(skyBridgeManager.skills),
          );
        } catch (e) {
          // ignore
        }
      }
    };
  }

  public destroy() {
    networkManager.resetHandlers();
  }
}
