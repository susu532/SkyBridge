import { World } from "./World";
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, WORLD_Y_OFFSET } from "./Chunk";
import { BLOCK, isSolidBlock, isAnyTorch } from "./TextureAtlas";
import { getBattleRoyaleBlock } from "./generation/BattleRoyaleGenerator";
import { noise2D, noise3D, getTerrainData } from "./TerrainGenerator";
import { buildHubCastles, generateHubTerrain } from "./generation/HubGenerator";
import { getCastleBlock } from "./generation/SkyCastlesGenerator";
import { getVillageBlock } from "./generation/SkyBridgeGenerator";
import { getGiantMythicalShipBlock } from "./generation/ShipGenerator";
import { getVoidTrailBlock } from "./generation/VoidTrailGenerator";
import { generateSkyIslandTerrain } from "./generation/SkyIslandGenerator";
import * as THREE from "three";
import { skycastlesBakedBlocks } from "./SkycastlesBakedBlocks";

export async function generateChunkMethod(
  world: World,
  cx: number,
  cz: number,
) {
  const key = world.getChunkKey(cx, cz);
  world.generatingChunks.add(key);
  const chunk = new Chunk(cx, cz);

  let startTime = performance.now();
  let iterations = 0;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      iterations++;
      if (iterations > 64 && performance.now() - startTime > 3) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        startTime = performance.now();
        iterations = 0;
      }

      const worldX = cx * CHUNK_SIZE + x;
      const worldZ = cz * CHUNK_SIZE + z;

      // Massive but not infinite: Stop generating solid ground far away
      const distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
      if (distFromCenter > world.worldSize) {
        // Beyond world size, just generate air
        continue;
      }

      if (world.isDungeonDelver) {
        // Iterate over vertical space. chunk y is 0-256. world y = y - 60
        for (let y = 0; y < 100; y++) {
          const worldY = y - 60;

          // Catacombs boundaries
          if (Math.abs(worldX) > 200 || Math.abs(worldZ) > 200) {
            if (worldY >= -5 && worldY <= 15) {
              chunk.setBlockFast(x, y, z, BLOCK.OBSIDIAN);
              continue;
            }
          }

          // Outer bedrock/floor limits
          if (worldY < -5) {
            chunk.setBlockFast(x, y, z, BLOCK.OBSIDIAN);
            continue;
          }
          if (worldY > 15) {
            chunk.setBlockFast(
              x,
              y,
              z,
              Math.abs(worldX) > 200 || Math.abs(worldZ) > 200
                ? BLOCK.AIR
                : BLOCK.STONE,
            );
            continue;
          }

          // Spawn Room (safe area)
          const distSq = worldX * worldX + worldZ * worldZ;
          if (distSq < 100) {
            if (worldY === -1) {
              chunk.setBlockFast(
                x,
                y,
                z,
                (Math.abs(worldX) + Math.abs(worldZ)) % 2 === 0
                  ? BLOCK.BRICK
                  : BLOCK.STONE,
              );
            } else if (worldY < -1) {
              chunk.setBlockFast(x, y, z, BLOCK.STONE);
            } else if (worldY > 5) {
              chunk.setBlockFast(x, y, z, BLOCK.CONCRETE_GRAY);
            } else if (distSq > 64 && distSq < 100) {
              if (worldZ < -3 && Math.abs(worldX) < 3)
                chunk.setBlockFast(x, y, z, BLOCK.AIR);
              else chunk.setBlockFast(x, y, z, BLOCK.STONE);
            } else {
              chunk.setBlockFast(x, y, z, BLOCK.AIR);
            }
            continue;
          }

          // Dungeon carving logic
          let isCarved = false;
          const roomNoise = noise2D(worldX * 0.05, worldZ * 0.05);
          if (roomNoise > 0.4) isCarved = true;

          const tunnelNoise1 = Math.abs(noise2D(worldX * 0.03, worldZ * 0.03));
          const tunnelNoise2 = Math.abs(
            noise2D(worldX * 0.03 + 1000, worldZ * 0.03 + 1000),
          );
          if (tunnelNoise1 < 0.06 || tunnelNoise2 < 0.06) isCarved = true;

          const caveNoise = noise3D(
            worldX * 0.04,
            worldY * 0.04,
            worldZ * 0.04,
          );
          if (caveNoise > 0.3) isCarved = true;

          if (isCarved) {
            if (worldY >= 0 && worldY <= 4) {
              if (worldY === 0 && caveNoise > 0.5)
                chunk.setBlockFast(x, y, z, BLOCK.LAVA);
              else chunk.setBlockFast(x, y, z, BLOCK.AIR);
            } else if (worldY === -1) {
              const detailNoise = noise2D(worldX * 0.2, worldZ * 0.2);
              if (detailNoise > 0.4) chunk.setBlockFast(x, y, z, BLOCK.DIRT);
              else if (detailNoise < -0.4)
                chunk.setBlockFast(x, y, z, BLOCK.CONCRETE_GRAY);
              else chunk.setBlockFast(x, y, z, BLOCK.STONE);
            } else if (worldY < -1) {
              chunk.setBlockFast(x, y, z, BLOCK.STONE);
            } else if (worldY === 5) {
              const glowNoise = noise2D(worldX * 0.1, worldZ * 0.1);
              if (glowNoise > 0.8) chunk.setBlockFast(x, y, z, BLOCK.GLOWSTONE);
              else chunk.setBlockFast(x, y, z, BLOCK.OBSIDIAN);
            } else if (worldY > 5) {
              chunk.setBlockFast(x, y, z, BLOCK.STONE);
            }
            continue;
          }

          // Solid walls
          const wallNoise = noise3D(worldX * 0.1, worldY * 0.1, worldZ * 0.1);
          if (wallNoise > 0.5) chunk.setBlockFast(x, y, z, BLOCK.OBSIDIAN);
          else if (wallNoise < -0.5) chunk.setBlockFast(x, y, z, BLOCK.BRICK);
          else chunk.setBlockFast(x, y, z, BLOCK.STONE);
        }
        continue;
      }

      if (world.isVoidtrail) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const worldY = y + WORLD_Y_OFFSET;
          const block = getVoidTrailBlock(worldX, worldY, worldZ);
          chunk.setBlockFast(x, y, z, block);
        }
        continue;
      }

      if (world.isBattleRoyale) {
        const mapRadius = 300;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const worldY = y + WORLD_Y_OFFSET;
          const block = getBattleRoyaleBlock(worldX, worldY, worldZ);
          chunk.setBlockFast(x, y, z, block);
        }
        continue;
      }

      if (world.isSkyIsland) {
        generateSkyIslandTerrain(chunk, x, z, worldX, worldZ);
        continue;
      }

      const isBlueSide = world.isSkyCastles ? worldZ >= 70 : worldZ >= 0;
      const isRedSide = world.isSkyCastles ? worldZ <= -70 : worldZ < 0;
      const isVoid = !isBlueSide && !isRedSide;
      const isBridge = world.isSkyCastles
        ? isVoid && worldX >= -8 && worldX <= 8
        : false;

      const t_bridge = Math.max(-1, Math.min(1, worldZ / 70));
      const curveOffset = 45 * (1 - t_bridge * t_bridge);
      const rightCenterX = 30 + curveOffset;
      const leftCenterX = -30 - curveOffset;
      const isRightCurve = Math.abs(worldX - rightCenterX) <= 2;
      const isLeftCurve = Math.abs(worldX - leftCenterX) <= 2;
      const isRightIsland =
        Math.pow(worldX - 75, 2) + Math.pow(worldZ, 2) <= 100;
      const isLeftIsland =
        Math.pow(worldX + 75, 2) + Math.pow(worldZ, 2) <= 100;
      const isSideBridge = isVoid && (isRightCurve || isLeftCurve);
      const isSideIsland = isVoid && (isRightIsland || isLeftIsland);

      if (world.isSkyCastles) {
        if (Math.abs(worldZ) >= 320 || Math.abs(worldX) > 95) {
          for (let y = 0; y < CHUNK_HEIGHT; y++)
            chunk.setBlockFast(x, y, z, BLOCK.AIR);
          // DO NOT continue here, so that Pirate Ship structures can be drawn later!
        }
      }

      const {
        height: terrainHeight,
        biome,
        isProtected: isAreaProtected,
        minHeight: terrainMinHeight,
      } = getTerrainData(
        worldX,
        worldZ,
        world.isSkyCastles,
        world.isHub,
        world.worldSize,
      );
      const maxProtectedZ = world.isSkyCastles ? 500 : 410;
      const villageStart = world.isSkyCastles ? 70 : 61;
      const protectionWidth = world.isSkyCastles ? 100 : 50;
      const isVillageOrCastle =
        worldX >= -protectionWidth &&
        worldX <= protectionWidth &&
        ((worldZ >= villageStart && maxProtectedZ >= worldZ) ||
          (worldZ <= -villageStart &&
            worldZ >= -maxProtectedZ &&
            world.isSkyCastles));
      const isBridgeArea = world.isSkyCastles
        ? worldX >= -12 && worldX <= 12 && worldZ > -70 && worldZ < 70
        : false;
      const isProtected = isVillageOrCastle || isBridgeArea || isAreaProtected;
      if (world.isHub) {
        generateHubTerrain(chunk, x, z, worldX, worldZ);
      } else if (world.isSkyIsland) {
        generateSkyIslandTerrain(chunk, x, z, worldX, worldZ);
      } else if (isBlueSide || isRedSide) {
        const hasCaves =
          !world.isSkyCastles &&
          !isProtected &&
          biome !== world.biomes.OCEAN &&
          noise2D(worldX * 0.01, worldZ * 0.01) > 0.3;
        const blueVillageStart = world.isSkyCastles ? 300 : 61;
        const blueVillageEnd = world.isSkyCastles ? 350 : 110;
        const isBlueVillage =
          worldZ >= blueVillageStart && worldZ <= blueVillageEnd;
        const isRedVillage =
          worldZ <= -blueVillageStart && worldZ >= -blueVillageEnd;

        let minIslandY = terrainMinHeight;
        if (!world.isSkyCastles) minIslandY = 0;

        for (
          let y = Math.max(0, Math.floor(minIslandY));
          y <= terrainHeight;
          y++
        ) {
          if (y === minIslandY) {
            chunk.setBlockFast(x, y, z, BLOCK.STONE); // Bedrock/Bottom layer
          } else {
            // Caves
            let isCave = false;
            if (hasCaves && y > 1 && y < terrainHeight - 4) {
              // Noodle caves (tunnels)
              const caveNoise1 = noise3D(
                worldX * 0.015,
                y * 0.015,
                worldZ * 0.015,
              );
              const caveNoise2 = noise3D(
                worldX * 0.015 + 1000,
                y * 0.015 + 1000,
                worldZ * 0.015 + 1000,
              );
              const tunnelRadius =
                0.08 +
                noise3D(worldX * 0.005, y * 0.005, worldZ * 0.005) * 0.05;
              // A tunnel is formed where two noise fields are both close to 0
              if (
                Math.abs(caveNoise1) < tunnelRadius &&
                Math.abs(caveNoise2) < tunnelRadius
              ) {
                isCave = true;
              }

              // Caverns (large open areas)
              const cavernNoise = noise3D(
                worldX * 0.008,
                y * 0.01,
                worldZ * 0.008,
              );
              if (cavernNoise > 0.3) {
                isCave = true;
              }
            }

            if (isCave) {
              if (y < 10) {
                chunk.setBlockFast(x, y, z, BLOCK.LAVA);
              }
            } else {
              if (y === terrainHeight) {
                // Path logic inside villages/castles
                let isPath = false;

                if (
                  !world.isSkyCastles &&
                  isBlueVillage &&
                  worldX >= -50 &&
                  worldX <= 50
                ) {
                  const villageOffset = world.isSkyCastles ? 169 : -70;
                  const wellZ = 85 + villageOffset;
                  if (worldX >= -3 && worldX <= 3) isPath = true;
                  else if (
                    worldZ >= wellZ - 3 &&
                    worldZ <= wellZ + 3 &&
                    worldX >= -45 &&
                    worldX <= 45
                  )
                    isPath = true;
                  else if (
                    worldX >= -30 &&
                    worldX <= -26 &&
                    Math.abs(worldZ - wellZ) <= 20
                  )
                    isPath = true;
                  else if (
                    worldX >= 26 &&
                    worldX <= 30 &&
                    Math.abs(worldZ - wellZ) <= 20
                  )
                    isPath = true;
                  else if (
                    worldX >= -9 &&
                    worldX <= -3 &&
                    Math.abs(worldZ - (96 + villageOffset)) <= 2
                  )
                    isPath = true;
                  else if (
                    worldX >= 3 &&
                    worldX <= 6 &&
                    Math.abs(worldZ - (70 + villageOffset)) <= 2
                  )
                    isPath = true;
                  else if (
                    worldX >= -15 &&
                    worldX <= -11 &&
                    Math.abs(worldZ - (65 + villageOffset)) <= 2
                  )
                    isPath = true;
                  else if (
                    worldX >= 6 &&
                    worldX <= 20 &&
                    Math.abs(worldZ - (97 + villageOffset)) <= 2
                  )
                    isPath = true;
                  else if (
                    worldX >= 38 &&
                    worldX <= 42 &&
                    Math.abs(worldZ - (75 + villageOffset)) <= 2
                  )
                    isPath = true;

                  if (isPath) {
                    const distSq =
                      worldX * worldX + (worldZ - wellZ) * (worldZ - wellZ);
                    if (distSq <= 12) isPath = false;
                  }
                } else if (isProtected) {
                  // Path from gate to keep
                  const zOffset = isBlueSide ? 100 : -100;
                  const localZ = worldZ - zOffset;
                  const gateZ = isBlueSide ? -30 : 30;
                  const keepGateZ = isBlueSide ? -12 : 12;
                  const minZ = Math.min(gateZ, keepGateZ);
                  const maxZ = Math.max(gateZ, keepGateZ);

                  if (
                    worldX >= -4 &&
                    worldX <= 4 &&
                    localZ >= minZ &&
                    localZ <= maxZ
                  ) {
                    isPath = true;
                  }
                }

                if (isPath) {
                  chunk.setBlockFast(
                    x,
                    y,
                    z,
                    (worldX + worldZ) % 3 === 0 ? BLOCK.STONE : BLOCK.SAND,
                  );
                } else if (
                  world.isSkyCastles &&
                  Math.abs(worldX) <= 5 &&
                  ((Math.abs(worldZ) >= 70 && Math.abs(worldZ) <= 170) ||
                    (Math.abs(worldZ) >= 230 && Math.abs(worldZ) <= 300))
                ) {
                  // Majestic Stairs refinement
                  chunk.setBlockFast(x, y, z, BLOCK.PLANKS);
                } else if (!isProtected && terrainHeight <= 61) {
                  chunk.setBlockFast(x, y, z, BLOCK.SAND);
                } else {
                  // Biome top block
                  let topBlock = biome.topBlock;
                  if (biome === world.biomes.MOUNTAINS && y > 100)
                    topBlock = BLOCK.SNOW;
                  chunk.setBlockFast(x, y, z, topBlock);
                }
              } else if (y >= terrainHeight - 3) {
                if (!isProtected && terrainHeight <= 61) {
                  chunk.setBlockFast(x, y, z, BLOCK.SAND);
                } else {
                  chunk.setBlockFast(x, y, z, biome.subBlock);
                }
              } else if (
                biome === world.biomes.BADLANDS &&
                y >= terrainHeight - 15
              ) {
                // Terracotta layers
                const layerNoise = Math.floor(
                  y + noise2D(worldX * 0.05, worldZ * 0.05) * 3,
                );
                if (layerNoise % 4 === 0) {
                  chunk.setBlockFast(x, y, z, BLOCK.TERRACOTTA);
                } else if (layerNoise % 4 === 1) {
                  chunk.setBlockFast(x, y, z, BLOCK.RED_SAND);
                } else {
                  chunk.setBlockFast(x, y, z, BLOCK.STONE);
                }
              } else {
                let blockType = BLOCK.STONE;
                const isDeepslate = y < 15;
                if (isDeepslate) blockType = BLOCK.DEEPSLATE;

                // Ores and Glowstone
                if (!world.isSkyCastles && y < 60) {
                  const oreNoise = noise3D(worldX * 0.1, y * 0.1, worldZ * 0.1);
                  if (oreNoise > 0.6) {
                    const oreTypeNoise = noise3D(
                      worldX * 0.05,
                      y * 0.05,
                      worldZ * 0.05,
                    );
                    if (y < 15 && oreTypeNoise > 0.8)
                      blockType = BLOCK.DEEPSLATE_DIAMOND_ORE;
                    else if (y < 30 && oreTypeNoise > 0.6)
                      blockType = isDeepslate
                        ? BLOCK.DEEPSLATE_GOLD_ORE
                        : BLOCK.GOLD_ORE;
                    else if (y < 30 && oreTypeNoise < -0.6)
                      blockType = isDeepslate
                        ? BLOCK.DEEPSLATE_LAPIS_ORE
                        : BLOCK.LAPIS_ORE;
                    else if (y < 20 && oreTypeNoise > 0.4 && oreTypeNoise < 0.6)
                      blockType = isDeepslate
                        ? BLOCK.DEEPSLATE_REDSTONE_ORE
                        : BLOCK.REDSTONE_ORE;
                    else if (y < 25 && oreTypeNoise < -0.8)
                      blockType = isDeepslate
                        ? BLOCK.DEEPSLATE_EMERALD_ORE
                        : BLOCK.EMERALD_ORE;
                    else if (y < 50 && oreTypeNoise > 0.2)
                      blockType = isDeepslate
                        ? BLOCK.DEEPSLATE_IRON_ORE
                        : BLOCK.IRON_ORE;
                    else
                      blockType = isDeepslate
                        ? BLOCK.DEEPSLATE_COAL_ORE
                        : BLOCK.COAL_ORE;
                  }
                }
                chunk.setBlockFast(x, y, z, blockType);
              }
            }
          }
        }

        // Water (Lakes/Ocean)
        if (terrainHeight < 62 && (!world.isSkyCastles || terrainHeight > 0)) {
          for (let y = terrainHeight + 1; y <= 62; y++) {
            if (biome === world.biomes.VOLCANIC) {
              chunk.setBlockFast(x, y, z, BLOCK.LAVA);
            } else {
              chunk.setBlockFast(x, y, z, BLOCK.WATER);
            }
          }
        }

        // Trees (only outside protected areas)
        if (
          !isProtected &&
          !world.isSkyCastles &&
          terrainHeight >= 63 &&
          biome.treeChance > 0
        ) {
          const treeNoise = noise2D(worldX * 13.37, worldZ * 13.37);
          if (treeNoise > 1 - biome.treeChance * 2) {
            // Tree probability
            // Determine tree type
            let logBlock = BLOCK.WOOD;
            let leavesBlock = BLOCK.LEAVES;
            let treeHeight = 5;

            if (biome.treeType === "BIRCH") {
              const typeNoise = noise2D(worldX * 0.1, worldZ * 0.1);
              if (typeNoise > 0.3) {
                logBlock = BLOCK.BIRCH_LOG;
                leavesBlock = BLOCK.BIRCH_LEAVES;
                treeHeight = 6;
              }
            } else if (biome.treeType === "SPRUCE") {
              logBlock = BLOCK.SPRUCE_LOG;
              leavesBlock = BLOCK.SPRUCE_LEAVES;
              treeHeight = 7;
            } else if (biome.treeType === "JUNGLE") {
              logBlock = BLOCK.WOOD;
              leavesBlock = BLOCK.LEAVES;
              treeHeight = 10;
            } else if (biome.treeType === "CACTUS") {
              logBlock = BLOCK.CACTUS;
              leavesBlock = BLOCK.AIR;
              treeHeight =
                3 + Math.floor((noise2D(worldX * 0.1, worldZ * 0.1) + 1) * 1.5);
            } else if (biome.treeType === "CHERRY") {
              logBlock = BLOCK.CHERRY_LOG;
              leavesBlock = BLOCK.CHERRY_LEAVES;
              treeHeight = 6;
            } else if (biome.treeType === "DARK_OAK") {
              logBlock = BLOCK.DARK_OAK_LOG;
              leavesBlock = BLOCK.DARK_OAK_LEAVES;
              treeHeight = 8;
            } else if (biome.treeType === "GIANT_MUSHROOM") {
              logBlock = BLOCK.MUSHROOM_STEM;
              leavesBlock =
                noise2D(worldX * 0.1, worldZ * 0.1) > 0
                  ? BLOCK.MUSHROOM_BLOCK_RED
                  : BLOCK.MUSHROOM_BLOCK_BROWN;
              treeHeight = 6;
            } else if (biome.treeType === "ICE_SPIKE") {
              logBlock = BLOCK.ICE;
              leavesBlock = BLOCK.AIR;
              treeHeight =
                10 + Math.floor((noise2D(worldX * 0.1, worldZ * 0.1) + 1) * 5);
            }

            for (let ty = 1; ty <= treeHeight; ty++) {
              if (terrainHeight + ty < CHUNK_HEIGHT) {
                chunk.setBlockFast(x, terrainHeight + ty, z, logBlock);
              }
            }
            // Leaves / Caps
            if (leavesBlock !== BLOCK.AIR) {
              if (biome.treeType === "GIANT_MUSHROOM") {
                // Mushroom cap
                for (let lx = -2; lx <= 2; lx++) {
                  for (let lz = -2; lz <= 2; lz++) {
                    if (Math.abs(lx) === 2 && Math.abs(lz) === 2) continue; // Round corners
                    const bx = x + lx;
                    const bz = z + lz;
                    if (
                      bx >= 0 &&
                      bx < CHUNK_SIZE &&
                      bz >= 0 &&
                      bz < CHUNK_SIZE
                    ) {
                      if (terrainHeight + treeHeight < CHUNK_HEIGHT) {
                        chunk.setBlockFast(
                          bx,
                          terrainHeight + treeHeight,
                          bz,
                          leavesBlock,
                        );
                      }
                    }
                  }
                }
              } else {
                // Normal leaves
                for (let lx = -2; lx <= 2; lx++) {
                  for (let lz = -2; lz <= 2; lz++) {
                    for (let ly = treeHeight - 2; ly <= treeHeight + 1; ly++) {
                      if (
                        Math.abs(lx) +
                          Math.abs(lz) +
                          Math.abs(ly - treeHeight) <=
                        3
                      ) {
                        const bx = x + lx;
                        const bz = z + lz;
                        if (
                          bx >= 0 &&
                          bx < CHUNK_SIZE &&
                          bz >= 0 &&
                          bz < CHUNK_SIZE
                        ) {
                          if (terrainHeight + ly < CHUNK_HEIGHT) {
                            if (
                              chunk.getBlock(bx, terrainHeight + ly, bz) ===
                              BLOCK.AIR
                            ) {
                              chunk.setBlockFast(
                                bx,
                                Math.floor(terrainHeight + ly),
                                bz,
                                leavesBlock,
                              );
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Plants (Tall grass, flowers, wheat)
        let allowPlants = !isProtected && !world.isSkyCastles;
        if (world.isSkyCastles) {
          const isCastleArea =
            Math.abs(worldZ) >= 170 &&
            Math.abs(worldZ) <= 230 &&
            Math.abs(worldX) <= 25;
          const isPathArea = Math.abs(worldX) <= 6;
          allowPlants = !isCastleArea && !isPathArea;
        }
        if (allowPlants && terrainHeight >= 63 && biome.plantChance > 0) {
          const plantNoise = noise2D(worldX * 42.42, worldZ * 42.42);
          if (plantNoise > 1 - biome.plantChance * 2) {
            const typeNoise = noise2D(worldX * 0.5, worldZ * 0.5);
            let plantBlock = BLOCK.TALL_GRASS;

            if (
              biome === world.biomes.DESERT ||
              biome === world.biomes.SAVANNA
            ) {
              if (typeNoise > 0.5) plantBlock = BLOCK.DEAD_BUSH;
            } else if (
              biome === world.biomes.SWAMP ||
              biome === world.biomes.DARK_FOREST
            ) {
              if (typeNoise > 0.6) plantBlock = BLOCK.MUSHROOM_RED;
              else if (typeNoise > 0.2) plantBlock = BLOCK.MUSHROOM_BROWN;
              else plantBlock = BLOCK.TALL_GRASS;
            } else if (biome === world.biomes.MUSHROOM_ISLAND) {
              if (typeNoise > 0.0) plantBlock = BLOCK.MUSHROOM_RED;
              else plantBlock = BLOCK.MUSHROOM_BROWN;
            } else if (biome === world.biomes.CHERRY_GROVE) {
              if (typeNoise > 0.3) plantBlock = BLOCK.FLOWER_RED;
              else plantBlock = BLOCK.TALL_GRASS;
            } else {
              if (typeNoise > 0.8) plantBlock = BLOCK.FLOWER_RED;
              else if (typeNoise > 0.6) plantBlock = BLOCK.FLOWER_YELLOW;
              else if (typeNoise > 0.4) plantBlock = BLOCK.WHEAT;
            }

            if (chunk.getBlock(x, terrainHeight + 1, z) === BLOCK.AIR) {
              chunk.setBlockFast(x, terrainHeight + 1, z, plantBlock);
            }
          }
        }

        // Animals (only outside protected areas)
        if (!world.isSkyCastles && !isProtected && terrainHeight >= 63) {
          const animalNoise = noise2D(worldX * 123.45, worldZ * 123.45);
          if (animalNoise > 0.99) {
            const typeNoise = noise2D(worldX * 0.2, worldZ * 0.2);
            let type = "Cow";
            if (typeNoise > 0.3) type = "Cow";
            else if (typeNoise < -0.3) type = "Sheep";
            world.queuedMobs.push({
              type,
              pos: new THREE.Vector3(
                worldX + 0.5,
                terrainHeight + 1 + WORLD_Y_OFFSET,
                worldZ + 0.5,
              ),
            });
          }
        }

        // Castles
        const castleZCenter = world.isSkyCastles ? 200 : 100;
        const isBlueCastleArea =
          isBlueSide &&
          worldX >= -35 &&
          worldX <= 35 &&
          worldZ >= castleZCenter - 35 &&
          worldZ <= castleZCenter + 35;
        const isRedCastleArea =
          isRedSide &&
          worldX >= -35 &&
          worldX <= 35 &&
          worldZ >= -(castleZCenter + 35) &&
          worldZ <= -(castleZCenter - 35);

        if (world.isSkyCastles && (isBlueCastleArea || isRedCastleArea)) {
          const castleYOffset = world.isSkyCastles ? 60 : 0;
          for (let y = 65; y < CHUNK_HEIGHT; y++) {
            let block = BLOCK.AIR;
            if (y >= 65 + castleYOffset) {
              if (isBlueCastleArea) {
                block = getCastleBlock(
                  worldX,
                  y - 60 - castleYOffset,
                  worldZ,
                  castleZCenter,
                  BLOCK.BLUE_STONE,
                  world.isSkyCastles,
                  world.queuedMobs,
                );
              } else if (isRedCastleArea) {
                block = getCastleBlock(
                  worldX,
                  y - 60 - castleYOffset,
                  worldZ,
                  -castleZCenter,
                  BLOCK.RED_STONE,
                  world.isSkyCastles,
                  world.queuedMobs,
                );
              }
            }
            if (block !== BLOCK.AIR && block !== -1) {
              chunk.setBlockFast(x, y, z, block);
            } else if (block === BLOCK.AIR && y >= 65 + castleYOffset) {
              chunk.setBlockFast(x, y, z, BLOCK.AIR);
            }
          }
        }

        if (world.isSkyCastles) {
          if (worldX === 5 && worldZ === 189) {
            const chunkY = 65 - WORLD_Y_OFFSET;
            chunk.setBlockFast(x, Math.floor(chunkY), z, BLOCK.CHEST);
          }
          if (worldX === 5 && worldZ === -189) {
            const chunkY = 65 - WORLD_Y_OFFSET;
            chunk.setBlockFast(x, Math.floor(chunkY), z, BLOCK.CHEST_REVERSED);
          }
        }

        // Villages
        if (
          !world.isSkyCastles &&
          isBlueVillage &&
          worldX >= -50 &&
          worldX <= 50
        ) {
          for (let y = 65; y < CHUNK_HEIGHT; y++) {
            const block = getVillageBlock(
              worldX,
              y - 60,
              worldZ,
              isBlueVillage,
              world.isSkyCastles,
            );
            if (block !== BLOCK.AIR) {
              chunk.setBlockFast(x, y, z, block);
            }
          }
        }
      } else if (isBridge) {
        if (world.isSkyCastles) {
          // "Wide flank floating" - Generate large floating platforms instead of a bridge
          // Use absolute Z for perfect symmetry between teams
          const islandNoise = noise2D(worldX * 0.04, Math.abs(worldZ) * 0.03);
          const detailNoise = noise2D(worldX * 0.2, Math.abs(worldZ) * 0.2);

          // Special logic for an elevated flat flank just in the middle
          const isMiddle = Math.abs(worldZ) < 12;
          const middleWidth = Math.abs(worldX) < 14;

          if (isMiddle && middleWidth) {
            const centerHeight = 75;
            const centerThickness = 5;

            const distFromCenter = Math.sqrt(
              (worldX * worldX) / 200 + (worldZ * worldZ) / 144,
            );
            if (distFromCenter < 1.0) {
              for (
                let y = centerHeight - centerThickness;
                y <= centerHeight;
                y++
              ) {
                let block = BLOCK.STONE;
                if (y === centerHeight) {
                  block =
                    Math.abs(worldX) < 12 && Math.abs(worldZ) < 10
                      ? BLOCK.GRASS
                      : BLOCK.STONE_BRICKS;
                } else if (y > centerHeight - 2) {
                  block = BLOCK.DIRT;
                }
                chunk.setBlockFast(x, y, z, block);
              }

              if (Math.abs(worldX) % 8 === 0 && Math.abs(worldZ) % 8 === 0) {
                chunk.setBlockFast(x, centerHeight + 1, z, BLOCK.SEA_LANTERN);
              }

              continue;
            }
          }

          if (islandNoise > 0.1) {
            const baseHeight =
              60 + Math.floor(noise2D(Math.abs(worldZ) * 0.01, 0) * 10);
            const thickness =
              4 +
              Math.floor((islandNoise - 0.1) * 10) +
              Math.floor(detailNoise * 2);

            for (let y = baseHeight - thickness; y <= baseHeight; y++) {
              let block = BLOCK.STONE;
              if (y === baseHeight) {
                block = detailNoise > 0.5 ? BLOCK.GRASS : BLOCK.STONE_BRICKS;
              } else if (y > baseHeight - 2) {
                block = BLOCK.DIRT;
              }
              if (y < baseHeight - thickness + 1 && detailNoise < -0.5)
                continue;
              chunk.setBlockFast(x, y, z, block);
            }
            if (islandNoise > 0.4 && detailNoise > 0.8) {
              chunk.setBlockFast(x, baseHeight + 1, z, BLOCK.SEA_LANTERN);
            }
          }
          continue;
        }

        // Enchanted Medieval Bridge structure (Original logic for non-Skycastles)
        for (let y = 50; y <= 64; y++) {
          const isPillarPos = Math.abs(worldZ) % 15 <= 2;
          const isLampPos = Math.abs(worldZ) % 15 === 0;
          const isSide = worldX === -8 || worldX === 8;
          const isOuterSide = worldX === -9 || worldX === 9;

          if (y < 63) {
            const archHeight = 6;
            const zOffset = Math.abs(worldZ) % 15;
            const archY =
              56 + Math.floor(Math.sin((zOffset / 15) * Math.PI) * archHeight);

            if (isSide || isOuterSide) {
              // Main pillars and arches
              if (y <= archY || isPillarPos) {
                let brickType = BLOCK.STONE_BRICKS;
                if ((worldX + worldZ + y) % 15 === 0)
                  brickType = BLOCK.MOSSY_STONE_BRICKS;
                if ((worldX + worldZ + y) % 20 === 0)
                  brickType = BLOCK.CHISELED_STONE_BRICKS;
                chunk.setBlockFast(x, y, z, brickType);
              }

              // Hanging Enchanted Vines
              if (y < 56 && y > 50 && (isSide || isOuterSide)) {
                if ((worldZ * 31 + worldX * 17) % 100 > 97) {
                  chunk.setBlockFast(x, y, z, BLOCK.LEAVES); // Hanging greenery
                }
              }
            }

            // Magical "Core" under the arch
            if (Math.abs(worldX) <= 1 && y === 62 && isLampPos) {
              chunk.setBlockFast(x, y, z, BLOCK.SEA_LANTERN);
            }

            if (isPillarPos && Math.abs(worldX) < 8) {
              // Structural cross-beams
              if (y === 62) chunk.setBlockFast(x, y, z, BLOCK.STONE_BRICKS);
            }
          } else if (y === 63) {
            // Bridge foundation layer
            let type = BLOCK.STONE_BRICKS;
            if (isSide) type = BLOCK.CHISELED_STONE_BRICKS;
            else if ((worldX + worldZ) % 10 === 0)
              type = BLOCK.MOSSY_STONE_BRICKS;
            chunk.setBlockFast(x, y, z, type);
          } else if (y === 64) {
            // Bridge deck
            if (isSide) {
              chunk.setBlockFast(x, y, z, BLOCK.CHISELED_STONE_BRICKS);
            } else {
              // Inlaid wood pattern
              const isCenter = Math.abs(worldX) <= 2;
              chunk.setBlockFast(
                x,
                y,
                z,
                isCenter ? BLOCK.DARK_OAK_PLANKS : BLOCK.SPRUCE_PLANKS,
              );
            }
          }
        }

        // Railings and Magical Spires
        if (worldX === -8 || worldX === 8) {
          const isLampPos = Math.abs(worldZ) % 15 === 0;
          if (isLampPos) {
            // Enchanted Spire
            chunk.setBlockFast(x, 65, z, BLOCK.CHISELED_STONE_BRICKS);
            chunk.setBlockFast(x, 66, z, BLOCK.STONE_BRICKS);
            chunk.setBlockFast(x, 67, z, BLOCK.SEA_LANTERN); // Floating crystal look
            chunk.setBlockFast(x, 68, z, BLOCK.GLASS_LIGHT_BLUE); // Crystal tip
          } else {
            // Ornate railing
            if (Math.abs(worldZ) % 3 === 0) {
              chunk.setBlockFast(x, 65, z, BLOCK.DARK_OAK_LOG);
            } else {
              chunk.setBlockFast(x, 65, z, BLOCK.STONE_BRICKS);
            }
          }
        }
      } else if (isSideIsland) {
        const distRightSq = Math.pow(worldX - 75, 2) + Math.pow(worldZ, 2);
        const distLeftSq = Math.pow(worldX + 75, 2) + Math.pow(worldZ, 2);
        const distSq = worldX > 0 ? distRightSq : distLeftSq;
        const dist = Math.sqrt(distSq);

        const islandDepth = Math.max(1, 10 - dist);
        const islandBase = 64 - Math.floor(islandDepth);

        for (let y = islandBase; y <= 64; y++) {
          if (y === 64) {
            chunk.setBlockFast(x, y, z, BLOCK.GRASS);
          } else if (y >= 64 - 2) {
            chunk.setBlockFast(x, y, z, BLOCK.DIRT);
          } else {
            chunk.setBlockFast(x, y, z, BLOCK.STONE);
          }
        }

        if (dist < 1.0) {
          for (let ty = 65; ty <= 68; ty++)
            chunk.setBlockFast(x, ty, z, BLOCK.DARK_OAK_LOG);
          for (let ly = 67; ly <= 69; ly++) {
            for (let lx = -2; lx <= 2; lx++) {
              for (let lz = -2; lz <= 2; lz++) {
                if (Math.abs(lx) + Math.abs(lz) < 3 || ly === 68) {
                  const targetX = x + lx;
                  const targetZ = z + lz;
                  if (
                    targetX >= 0 &&
                    targetX < CHUNK_SIZE &&
                    targetZ >= 0 &&
                    targetZ < CHUNK_SIZE
                  ) {
                    if (chunk.getBlock(targetX, ly, targetZ) === BLOCK.AIR) {
                      chunk.setBlockFast(
                        targetX,
                        ly,
                        targetZ,
                        BLOCK.DARK_OAK_LEAVES,
                      );
                    }
                  }
                }
              }
            }
          }
        } else if (
          dist > 3 &&
          dist < 4 &&
          Math.abs(worldX + worldZ) % 3 === 0
        ) {
          chunk.setBlockFast(x, 65, z, BLOCK.TALL_GRASS);
        }
      } else if (isSideBridge) {
        const isRightSideEdge =
          worldX > 0 && Math.abs(worldX - rightCenterX) >= 1.5;
        const isLeftSideEdge =
          worldX < 0 && Math.abs(worldX - leftCenterX) >= 1.5;
        const isEdge = isRightSideEdge || isLeftSideEdge;
        const sketchyHole = noise2D(worldX * 0.4, worldZ * 0.4) > 0.6;

        if (!sketchyHole || isEdge) {
          chunk.setBlockFast(
            x,
            64,
            z,
            isEdge ? BLOCK.SPRUCE_LOG : BLOCK.SPRUCE_PLANKS,
          );
        }

        if (!isEdge && !sketchyHole) {
          chunk.setBlockFast(x, 63, z, BLOCK.SPRUCE_PLANKS);
        }

        if (isEdge && Math.abs(worldZ) % 15 === 0) {
          chunk.setBlockFast(x, 65, z, BLOCK.SPRUCE_LOG);
        }
      }

      // Side Mines (Underground Tunnels connecting bases)
      if (!world.isHub) {
        const isLeftMineArea = worldX >= -40 && worldX <= -24;
        const isRightMineArea = worldX >= 24 && worldX <= 40;
        const mineZLimit = world.isSkyCastles ? 310 : 140;

        if (
          (isLeftMineArea || isRightMineArea) &&
          worldZ >= -mineZLimit &&
          worldZ <= mineZLimit
        ) {
          const centerX = worldX < 0 ? -32 : 32;
          const tunnelY = 6; // Floor at Y=6, walk at Y=7

          // Check if we are at the entry shafts (Z = ±78)
          const isEntryZ =
            Math.abs(worldZ - 78) <= 2 || Math.abs(worldZ + 78) <= 2;
          const isEntryX = Math.abs(worldX - centerX) <= 2;
          const isEntryShaft = isEntryZ && isEntryX;

          // Tunnel dimensions
          const dyCenter = tunnelY + 3;
          const sqDistToCenter = (worldX - centerX) * (worldX - centerX);

          for (let y = 0; y <= CHUNK_HEIGHT - 1; y++) {
            const dyTop = y - dyCenter;
            const distSq = sqDistToCenter + dyTop * dyTop;
            const innerRadiusSq = 3 * 3;
            const outerRadiusSq = 5 * 5;

            const isInsideTunnel = distSq <= innerRadiusSq;
            const isTunnelShell =
              distSq <=
              outerRadiusSq + noise3D(worldX * 0.1, y * 0.1, worldZ * 0.1) * 5;

            let blockToPlace: number | null = null;

            // Generate Shaft
            if (isEntryShaft) {
              if (y >= tunnelY && y <= terrainHeight) {
                // Hollow out the core of the shaft, place ladders/vines? or stairs
                const shaftDistSq =
                  (worldX - centerX) * (worldX - centerX) +
                  Math.min(Math.abs(worldZ - 78), Math.abs(worldZ + 78)) ** 2;
                if (shaftDistSq <= 2) {
                  // Water elevator or just air? Let's use scaffolding or air
                  // Actually we'll just put air for the shaft and water at the bottom
                  if (y === tunnelY && shaftDistSq === 0)
                    blockToPlace = BLOCK.WATER;
                  else blockToPlace = BLOCK.AIR;
                } else if (shaftDistSq <= 6) {
                  // Walls of the shaft
                  if (y > tunnelY) blockToPlace = BLOCK.STONE_BRICKS;
                }
              }
            }

            // Generate Tunnel
            if (blockToPlace === null && isInsideTunnel) {
              if (y >= tunnelY && y <= tunnelY + 4) {
                blockToPlace = BLOCK.AIR;
                // Decorations
                const localX = worldX - centerX;
                if (Math.abs(worldZ) % 8 <= 1) {
                  if (
                    Math.abs(localX) === 2 ||
                    y === tunnelY + 4 ||
                    y === tunnelY
                  ) {
                    blockToPlace = BLOCK.STRIPPED_OAK_LOG;
                  }
                }
                if (
                  Math.abs(worldZ) % 8 === 0 &&
                  y === tunnelY + 2 &&
                  Math.abs(localX) === 1
                ) {
                  blockToPlace = localX === 1 ? BLOCK.TORCH_WALL_X_POS : BLOCK.TORCH_WALL_X_NEG;
                }
              } else if (y === tunnelY - 1) {
                blockToPlace = BLOCK.STONE;
              }
            } else if (blockToPlace === null && isTunnelShell) {
              if (
                y < Math.max(terrainHeight - 3, tunnelY + 5) ||
                terrainHeight === 0
              ) {
                if (Math.random() < 0.2) blockToPlace = BLOCK.DEEPSLATE;
                else if (Math.random() < 0.3)
                  blockToPlace = BLOCK.MOSSY_COBBLESTONE;
                else blockToPlace = BLOCK.COBBLESTONE;
              }
            }

            if (blockToPlace !== null) {
              const curr = chunk.getBlock(x, y, z);
              // Ensure we don't overwrite bedrock or very top blocks unless it is our shaft
              if (y > 0 && curr !== BLOCK.CHEST) {
                chunk.setBlockFast(x, y, z, blockToPlace);
              }
            }
          }
        }
      }

      iterations++;
      if (iterations % 4 === 0 && performance.now() - startTime > 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        startTime = performance.now();
      }
    }
  }

  // Apply baked blocks
  if (!world.isHub) {
    if (world.isSkyCastles && !world.isVoidtrail) {
      if (!world.bakedBlocksProcessed) {
        world.bakedBlocksProcessed = true;
        world.skycastlesBakedChunkMap = new Map();
        world.bakedBlocksChunkMap = new Map();
        const processMap = (
          source: Map<string, number>,
          target: Map<string, any[]>,
        ) => {
          for (const [key, type] of source.entries()) {
            const [bx, by, bz] = key.split(",").map(Number);
            const ccx = Math.floor(bx / 16);
            const ccz = Math.floor(bz / 16);
            const cKey = ccx + "," + ccz;
            if (!target.has(cKey)) target.set(cKey, []);
            target
              .get(cKey)!
              .push({ x: bx & 15, y: by - WORLD_Y_OFFSET, z: bz & 15, type });
          }
        };
        processMap(skycastlesBakedBlocks, world.skycastlesBakedChunkMap);
        processMap(world.bakedBlocks, world.bakedBlocksChunkMap);
      }

      const chunkKeyStr = cx + "," + cz;

      const skList = world.skycastlesBakedChunkMap.get(chunkKeyStr);
      if (skList) {
        for (let i = 0; i < skList.length; i++) {
          const b = skList[i];
          if (b.y >= 0 && b.y < CHUNK_HEIGHT)
            chunk.setBlockFast(b.x, b.y, b.z, b.type);
        }
      }

      const bbList = world.bakedBlocksChunkMap.get(chunkKeyStr);
      if (bbList) {
        for (let i = 0; i < bbList.length; i++) {
          const b = bbList[i];
          if (b.y >= 0 && b.y < CHUNK_HEIGHT)
            chunk.setBlockFast(b.x, b.y, b.z, b.type);
        }
      }

      // --- Injection for new structures (chests & small ships) ---
      for (let ix = 0; ix < CHUNK_SIZE; ix++) {
        for (let iz = 0; iz < CHUNK_SIZE; iz++) {
          const worldX = cx * CHUNK_SIZE + ix;
          const worldZ = cz * CHUNK_SIZE + iz;

          // Explicit Chests near tree
          if ((worldX === 75 || worldX === -75) && worldZ === 1) {
            if (5 - WORLD_Y_OFFSET >= 0 && 5 - WORLD_Y_OFFSET < CHUNK_HEIGHT) {
              chunk.setBlockFast(
                ix,
                5 - WORLD_Y_OFFSET,
                iz,
                BLOCK.CHEST
              );
            }
          }

          // Mid void chests
          if (worldX === 0 && (worldZ === 10 || worldZ === -9)) {
            if (15 - WORLD_Y_OFFSET >= 0 && 15 - WORLD_Y_OFFSET < CHUNK_HEIGHT)
              chunk.setBlockFast(ix, 15 - WORLD_Y_OFFSET, iz, BLOCK.PLANKS);
            if (
              16 - WORLD_Y_OFFSET >= 0 &&
              16 - WORLD_Y_OFFSET < CHUNK_HEIGHT
            ) {
              chunk.setBlockFast(
                ix,
                16 - WORLD_Y_OFFSET,
                iz,
                worldZ === 10 ? BLOCK.CHEST : BLOCK.CHEST_REVERSED,
              );
            }
          }

          // Small ships
          const centerZ = worldZ >= 0 ? 310 : -310;
          const isShip =
            Math.abs(worldZ - centerZ) <= 8 && Math.abs(worldX) <= 3;
          if (isShip) {
            const shipGroundY = 8;
            const yLocal = shipGroundY - WORLD_Y_OFFSET;
            const dz = (worldZ - centerZ) * (worldZ >= 0 ? -1 : 1);
            const ax = Math.abs(worldX);

            if (yLocal >= 0 && yLocal + 10 < CHUNK_HEIGHT) {
              // Base and air clearing
              for (let hy = 0; hy <= 10; hy++) {
                chunk.setBlockFast(ix, yLocal + hy, iz, BLOCK.AIR);
              }

              // Floor
              if (yLocal >= 0 && yLocal < CHUNK_HEIGHT) {
                if (ax === 0 && dz >= -5 && dz <= 5)
                  chunk.setBlockFast(ix, yLocal, iz, BLOCK.DARK_OAK_PLANKS);
                else if (ax === 1 && dz >= -4 && dz <= 4)
                  chunk.setBlockFast(ix, yLocal, iz, BLOCK.DARK_OAK_PLANKS);
                else if (ax === 2 && dz >= -2 && dz <= 2)
                  chunk.setBlockFast(ix, yLocal, iz, BLOCK.DARK_OAK_PLANKS);
              }

              // Walls
              if (yLocal + 1 >= 0 && yLocal + 1 < CHUNK_HEIGHT) {
                if (ax === 0 && dz >= 6 && dz <= 8)
                  chunk.setBlockFast(ix, yLocal + 1, iz, BLOCK.SPRUCE_LOG); // Bowsprit
                else if (ax === 2 && dz >= -2 && dz <= 2)
                  chunk.setBlockFast(ix, yLocal + 1, iz, BLOCK.WOOD);
                else if (ax === 1 && (dz === 3 || dz === 4 || dz === 5))
                  chunk.setBlockFast(ix, yLocal + 1, iz, BLOCK.WOOD);
                else if (ax === 2 && dz === 3)
                  chunk.setBlockFast(ix, yLocal + 1, iz, BLOCK.WOOD);
                else if (ax === 1 && (dz === -3 || dz === -4))
                  chunk.setBlockFast(ix, yLocal + 1, iz, BLOCK.WOOD);
                else if (ax === 0 && dz === -5)
                  chunk.setBlockFast(ix, yLocal + 1, iz, BLOCK.WOOD);

                // Stern deck
                if (ax <= 1 && dz <= -3 && dz >= -5)
                  chunk.setBlockFast(ix, yLocal + 1, iz, BLOCK.DARK_OAK_PLANKS);

                // Chest - moved to dz = -1
                if (worldX === 0 && dz === -1) {
                  chunk.setBlockFast(
                    ix,
                    yLocal + 1,
                    iz,
                    worldZ >= 0 ? BLOCK.CHEST_REVERSED : BLOCK.CHEST,
                  );
                }
              }

              // Stern raised part
              if (yLocal + 2 >= 0 && yLocal + 2 < CHUNK_HEIGHT) {
                if (ax <= 1 && dz <= -3 && dz >= -5) {
                  if (ax === 1 || dz === -5)
                    chunk.setBlockFast(ix, yLocal + 2, iz, BLOCK.PLANKS);
                }
              }

              // Mast
              if (worldX === 0 && dz === 0) {
                for (let hy = 1; hy <= 8; hy++) {
                  if (yLocal + hy >= 0 && yLocal + hy < CHUNK_HEIGHT)
                    chunk.setBlockFast(ix, yLocal + hy, iz, BLOCK.SPRUCE_LOG);
                }
                if (yLocal + 9 >= 0 && yLocal + 9 < CHUNK_HEIGHT)
                  chunk.setBlockFast(ix, yLocal + 9, iz, BLOCK.PLANKS); // Crow's nest
              }

              // Sail
              if (dz === 1 && ax <= 2) {
                for (let hy = 3; hy <= 7; hy++) {
                  if (yLocal + hy >= 0 && yLocal + hy < CHUNK_HEIGHT) {
                    const sailWidth = hy === 3 || hy === 7 ? 1 : 2;
                    if (ax <= sailWidth)
                      chunk.setBlockFast(ix, yLocal + hy, iz, BLOCK.WOOL_WHITE);
                  }
                }
              }
            }
          }
        }
      }
      // --- End Injection ---
    }
  }

  await world.applyNetworkBlockChanges(chunk, cx, cz);

  // Calculate sunlight
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      let lightLevel = 15;
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const type = chunk.getBlock(x, y, z);
        if (isSolidBlock(type)) {
          lightLevel = 0;
        } else if (type === BLOCK.WATER || type === BLOCK.WATER_1) {
          lightLevel = Math.max(0, lightLevel - 2);
        } else if (type === BLOCK.LEAVES) {
          lightLevel = Math.max(0, lightLevel - 1);
        }

        if (type === BLOCK.GLOWSTONE || type === BLOCK.LAVA || isAnyTorch(type)) {
          lightLevel = 14;
        }

        chunk.setLightFast(x, y, z, lightLevel);

        if (lightLevel > 0 && lightLevel < 15) {
          world.lightingManager.addLightUpdate(
            cx * CHUNK_SIZE + x,
            y + WORLD_Y_OFFSET,
            cz * CHUNK_SIZE + z,
            lightLevel,
          );
        } else if (
          lightLevel === 15 &&
          (type === BLOCK.GLOWSTONE || type === BLOCK.LAVA)
        ) {
          world.lightingManager.addLightUpdate(
            cx * CHUNK_SIZE + x,
            y + WORLD_Y_OFFSET,
            cz * CHUNK_SIZE + z,
            15,
          );
        }
      }
    }
  }

  world.chunks.set(key, chunk);
  world.generatingChunks.delete(key);

  // Mark neighbors for update so they can hide faces at the boundary with this new chunk
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      const neighbor = world.getChunk(cx + dx, cz + dz);
      if (neighbor) neighbor.needsUpdate = true;
    }
  }

  return chunk;
}
