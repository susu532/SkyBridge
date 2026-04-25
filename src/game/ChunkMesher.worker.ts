// Worker for offloading Chunk Meshing and Terrain Generation
// This establishes the architecture for passing Float32Arrays directly to Three.js

import { BLOCK, getBlockUVs, isTransparent, isCutout, isSolidBlock, isSlab, isWater, ATLAS_TILES, isPlant, isLeaves, isAnyTorch } from './TextureAtlas';

export interface ChunkMesherRequest {
  taskId: number;
  chunkX: number;
  chunkZ: number;
  blocks: Uint16Array;
  light: Uint8Array;
  neighborsBlocks: (Uint16Array | null)[];
  neighborsLight: (Uint8Array | null)[];
  performanceMode: boolean;
}

export interface ChunkMesherResponse {
  taskId: number;
  opaque: {
    positions: Float32Array;
    normals: Float32Array;
    colors: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    tileBases: Float32Array;
    sways: Float32Array;
  } | null;
  transparent: {
    positions: Float32Array;
    normals: Float32Array;
    colors: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    tileBases: Float32Array;
    sways: Float32Array;
  } | null;
}

self.onmessage = (e: MessageEvent<ChunkMesherRequest>) => {
  const data = e.data;
  const response = runMesher(data);
  
  const transfer: ArrayBuffer[] = [];
  const pushLayer = (layer: any) => {
    if (layer) {
      transfer.push(layer.positions.buffer, layer.normals.buffer, layer.uvs.buffer, layer.colors.buffer, layer.indices.buffer, layer.tileBases.buffer, layer.sways.buffer);
    }
  };
  
  pushLayer(response.opaque);
  pushLayer(response.transparent);

  (self as unknown as Worker).postMessage(response, transfer as any);
};

// Auto-generated greedy mesher
export function runMesher(data: ChunkMesherRequest): ChunkMesherResponse {
  let allAir = true;
  for (let i = 0; i < data.blocks.length; i++) {
    if (data.blocks[i] !== 0) { // BLOCK.AIR is 0
      allAir = false;
      break;
    }
  }

  if (allAir) {
    return { taskId: data.taskId, opaque: null, transparent: null };
  }

  const performanceMode = data.performanceMode;
  const CHUNK_SIZE = 16;
  const CHUNK_HEIGHT = 128;
  const WORLD_Y_OFFSET = -60;


class DynamicFloat32Buffer {
  data: Float32Array;
  length: number = 0;
  constructor(initialSize = 32768) {
    this.data = new Float32Array(initialSize);
  }
  push4(a: number, b: number, c: number, d: number) {
    if (this.length + 4 > this.data.length) this._grow(4);
    this.data[this.length++] = a; this.data[this.length++] = b;
    this.data[this.length++] = c; this.data[this.length++] = d;
  }
  push8(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) {
    if (this.length + 8 > this.data.length) this._grow(8);
    this.data[this.length++] = a; this.data[this.length++] = b;
    this.data[this.length++] = c; this.data[this.length++] = d;
    this.data[this.length++] = e; this.data[this.length++] = f;
    this.data[this.length++] = g; this.data[this.length++] = h;
  }
  push12(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) {
    if (this.length + 12 > this.data.length) this._grow(12);
    this.data[this.length++] = a; this.data[this.length++] = b;
    this.data[this.length++] = c; this.data[this.length++] = d;
    this.data[this.length++] = e; this.data[this.length++] = f;
    this.data[this.length++] = g; this.data[this.length++] = h;
    this.data[this.length++] = i; this.data[this.length++] = j;
    this.data[this.length++] = k; this.data[this.length++] = l;
  }
  _grow(minAmount: number) {
    const newSize = Math.max(this.data.length * 2, this.data.length + minAmount);
    const newData = new Float32Array(newSize);
    newData.set(this.data);
    this.data = newData;
  }
  toArray() {
    return new Float32Array(this.data.buffer, 0, this.length);
  }
}

class DynamicUint32Buffer {
  data: Uint32Array;
  length: number = 0;
  constructor(initialSize = 16384) {
    this.data = new Uint32Array(initialSize);
  }
  push6(a: number, b: number, c: number, d: number, e: number, f: number) {
    if (this.length + 6 > this.data.length) this._grow(6);
    this.data[this.length++] = a; this.data[this.length++] = b;
    this.data[this.length++] = c; this.data[this.length++] = d;
    this.data[this.length++] = e; this.data[this.length++] = f;
  }
  _grow(minAmount: number) {
    const newSize = Math.max(this.data.length * 2, this.data.length + minAmount);
    const newData = new Uint32Array(newSize);
    newData.set(this.data);
    this.data = newData;
  }
  toArray() {
    return new Uint32Array(this.data.buffer, 0, this.length);
  }
}

class LayerData {
  positions = new DynamicFloat32Buffer(32768);
  normals = new DynamicFloat32Buffer(32768);
  uvs = new DynamicFloat32Buffer(16384);
  tileBases = new DynamicFloat32Buffer(16384);
  colors = new DynamicFloat32Buffer(32768);
  sways = new DynamicFloat32Buffer(16384);
  indices = new DynamicUint32Buffer(16384);
  offset = 0;
}

    const opaque = new LayerData();
    const transparent = new LayerData();

    const getAO = (b1: boolean, b2: boolean, b3: boolean) => {
      if (performanceMode) return 3; // No AO in performance mode
      if (b1 && b2) return 0;
      return 3 - ((b1 ? 1 : 0) + (b2 ? 1 : 0) + (b3 ? 1 : 0));
    };

    const getWaterHeight = (lx: number, lz: number, ly: number) => {
      let b;
      if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
        b = data.blocks[lx | (lz << 4) | (ly << 8)];
      } else {
        const cdx = Math.floor(lx / 16);
        const cdz = Math.floor(lz / 16);
        const c = { blocks: data.neighborsBlocks[(cdx + 1) + (cdz + 1) * 3], light: data.neighborsLight[(cdx + 1) + (cdz + 1) * 3] };
        if (c) {
          b = c.blocks[(lx & 15) | ((lz & 15) << 4) | (ly << 8)];
        } else {
          b = BLOCK.AIR;
        }
      }
      
      if (!isWater(b)) return -1;
      
      let above;
      if (ly + 1 < 128) {
        if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
          above = data.blocks[lx | (lz << 4) | ((ly + 1) << 8)];
        } else {
          const cdx = Math.floor(lx / 16);
          const cdz = Math.floor(lz / 16);
          const c = { blocks: data.neighborsBlocks[(cdx + 1) + (cdz + 1) * 3], light: data.neighborsLight[(cdx + 1) + (cdz + 1) * 3] };
          if (c) {
            above = c.blocks[(lx & 15) | ((lz & 15) << 4) | ((ly + 1) << 8)];
          } else {
            above = BLOCK.AIR;
          }
        }
      } else {
        above = BLOCK.AIR;
      }
      
      if (isWater(above)) return 1.0;
      if (b === BLOCK.WATER) return 0.9;
      return 0.9 - ((b - BLOCK.WATER_1 + 1) * 0.1);
    };

    const getCornerHeight = (vx: number, vz: number, vy: number) => {
      let sum = 0;
      let count = 0;
      let waterAbove = false;
      
      for (let dz = -1; dz <= 0; dz++) {
        for (let dx = -1; dx <= 0; dx++) {
          const h = getWaterHeight(vx + dx, vz + dz, vy);
          if (h >= 0) {
            if (h >= 1.0) waterAbove = true;
            sum += h;
            count++;
          }
        }
      }
      
      if (waterAbove) return 1.0;
      if (count === 0) return 0.9;
      return sum / count;
    };

    const p = [
      [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
      [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]
    ];
    const faceUVs = [[0, 0], [0, 0], [0, 0], [0, 0]];
    const ao = [3, 3, 3, 3];

    const addFace = (x: number, y: number, z: number, dir: number, blockType: number, layer: any) => {
      const uvsCoords = getBlockUVs(blockType)[dir];
      const u = uvsCoords[0] / ATLAS_TILES;
      const v = 1 - (uvsCoords[1] + 1) / ATLAS_TILES;
      const du = 1 / ATLAS_TILES;
      const dv = 1 / ATLAS_TILES;

      p[0][0] = x;     p[0][1] = y;     p[0][2] = z + 1;
      p[1][0] = x + 1; p[1][1] = y;     p[1][2] = z + 1;
      p[2][0] = x + 1; p[2][1] = y + 1; p[2][2] = z + 1;
      p[3][0] = x;     p[3][1] = y + 1; p[3][2] = z + 1;
      p[4][0] = x + 1; p[4][1] = y;     p[4][2] = z;
      p[5][0] = x;     p[5][1] = y;     p[5][2] = z;
      p[6][0] = x;     p[6][1] = y + 1; p[6][2] = z;
      p[7][0] = x + 1; p[7][1] = y + 1; p[7][2] = z;

      if (isSlab(blockType)) {
        p[2][1] = y + 0.5;
        p[3][1] = y + 0.5;
        p[6][1] = y + 0.5;
        p[7][1] = y + 0.5;
      }

      if (isWater(blockType) && dir !== 3) {
        let above;
        if (y + 1 < 128) {
          above = data.blocks[x | (z << 4) | ((y + 1) << 8)];
        } else {
          above = BLOCK.AIR;
        }
        if (!isWater(above)) {
          p[2][1] = y + getCornerHeight(x + 1, z + 1, y);
          p[3][1] = y + getCornerHeight(x, z + 1, y);
          p[6][1] = y + getCornerHeight(x, z, y);
          p[7][1] = y + getCornerHeight(x + 1, z, y);
        }
      }

      faceUVs[0][0] = u;      faceUVs[0][1] = v;
      faceUVs[1][0] = u + du; faceUVs[1][1] = v;
      faceUVs[2][0] = u + du; faceUVs[2][1] = v + dv;
      faceUVs[3][0] = u;      faceUVs[3][1] = v + dv;

      ao[0] = 3; ao[1] = 3; ao[2] = 3; ao[3] = 3;
      const isSolid = (dx: number, dy: number, dz: number) => {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (ny < 0 || ny >= 128) return false;
        
        if ((nx & ~15) === 0 && (nz & ~15) === 0) {
          return isSolidBlock(data.blocks[nx | (nz << 4) | (ny << 8)]);
        } else {
          const cdx = nx >> 4;
          const cdz = nz >> 4;
          const c = { blocks: data.neighborsBlocks[(cdx + 1) + (cdz + 1) * 3], light: data.neighborsLight[(cdx + 1) + (cdz + 1) * 3] };
          if (c) {
            return isSolidBlock(c.blocks[(nx & 15) | ((nz & 15) << 4) | (ny << 8)]);
          }
          return false;
        }
      };

      let p0, p1, p2, p3;
      let nx = 0, ny = 0, nz = 0;

      switch (dir) {
        case 0: p0 = p[1]; p1 = p[4]; p2 = p[7]; p3 = p[2]; nx = 1; break;
        case 1: p0 = p[5]; p1 = p[0]; p2 = p[3]; p3 = p[6]; nx = -1; break;
        case 2: p0 = p[3]; p1 = p[2]; p2 = p[7]; p3 = p[6]; ny = 1; break;
        case 3: p0 = p[5]; p1 = p[4]; p2 = p[1]; p3 = p[0]; ny = -1; break;
        case 4: p0 = p[0]; p1 = p[1]; p2 = p[2]; p3 = p[3]; nz = 1; break;
        case 5: p0 = p[4]; p1 = p[5]; p2 = p[6]; p3 = p[7]; nz = -1; break;
      }

      if (layer === opaque) {
        switch (dir) {
          case 0: ao[0] = getAO(isSolid(1,-1,0), isSolid(1,0,1), isSolid(1,-1,1)); ao[1] = getAO(isSolid(1,-1,0), isSolid(1,0,-1), isSolid(1,-1,-1)); ao[2] = getAO(isSolid(1,1,0), isSolid(1,0,-1), isSolid(1,1,-1)); ao[3] = getAO(isSolid(1,1,0), isSolid(1,0,1), isSolid(1,1,1)); break;
          case 1: ao[0] = getAO(isSolid(-1,-1,0), isSolid(-1,0,-1), isSolid(-1,-1,-1)); ao[1] = getAO(isSolid(-1,-1,0), isSolid(-1,0,1), isSolid(-1,-1,1)); ao[2] = getAO(isSolid(-1,1,0), isSolid(-1,0,1), isSolid(-1,1,1)); ao[3] = getAO(isSolid(-1,1,0), isSolid(-1,0,-1), isSolid(-1,1,-1)); break;
          case 2: ao[0] = getAO(isSolid(-1,1,0), isSolid(0,1,1), isSolid(-1,1,1)); ao[1] = getAO(isSolid(1,1,0), isSolid(0,1,1), isSolid(1,1,1)); ao[2] = getAO(isSolid(1,1,0), isSolid(0,1,-1), isSolid(1,1,-1)); ao[3] = getAO(isSolid(-1,1,0), isSolid(0,1,-1), isSolid(-1,1,-1)); break;
          case 3: ao[0] = getAO(isSolid(-1,-1,0), isSolid(0,-1,-1), isSolid(-1,-1,-1)); ao[1] = getAO(isSolid(1,-1,0), isSolid(0,-1,-1), isSolid(1,-1,-1)); ao[2] = getAO(isSolid(1,-1,0), isSolid(0,-1,1), isSolid(1,-1,1)); ao[3] = getAO(isSolid(-1,-1,0), isSolid(0,-1,1), isSolid(-1,-1,1)); break;
          case 4: ao[0] = getAO(isSolid(-1,0,1), isSolid(0,-1,1), isSolid(-1,-1,1)); ao[1] = getAO(isSolid(1,0,1), isSolid(0,-1,1), isSolid(1,-1,1)); ao[2] = getAO(isSolid(1,0,1), isSolid(0,1,1), isSolid(1,1,1)); ao[3] = getAO(isSolid(-1,0,1), isSolid(0,1,1), isSolid(-1,1,1)); break;
          case 5: ao[0] = getAO(isSolid(1,0,-1), isSolid(0,-1,-1), isSolid(1,-1,-1)); ao[1] = getAO(isSolid(-1,0,-1), isSolid(0,-1,-1), isSolid(-1,-1,-1)); ao[2] = getAO(isSolid(-1,0,-1), isSolid(0,1,-1), isSolid(-1,1,-1)); ao[3] = getAO(isSolid(1,0,-1), isSolid(0,1,-1), isSolid(1,1,-1)); break;
        }
      }

      let lx = 0, ly = 0, lz = 0;
      switch (dir) {
        case 0: lx = 1; break; case 1: lx = -1; break;
        case 2: ly = 1; break; case 3: ly = -1; break;
        case 4: lz = 1; break; case 5: lz = -1; break;
      }
      const light = getLightLevel(x,y,z,lx,ly,lz);
      const isEmissive = blockType === BLOCK.GLOWSTONE || blockType === BLOCK.LAVA || isAnyTorch(blockType);
      const lightMult = isEmissive ? 1.0 : Math.max(0.1, Math.pow(0.85, 15 - light));
      
      const l0 = (layer === transparent || isEmissive) ? lightMult : ((ao[0] + 1) / 4) * lightMult;
      const l1 = (layer === transparent || isEmissive) ? lightMult : ((ao[1] + 1) / 4) * lightMult;
      const l2 = (layer === transparent || isEmissive) ? lightMult : ((ao[2] + 1) / 4) * lightMult;
      const l3 = (layer === transparent || isEmissive) ? lightMult : ((ao[3] + 1) / 4) * lightMult;

      layer.positions.push12(
        p0![0], p0![1], p0![2],
        p1![0], p1![1], p1![2],
        p2![0], p2![1], p2![2],
        p3![0], p3![1], p3![2]
      );
      
      layer.normals.push12(
        nx, ny, nz,
        nx, ny, nz,
        nx, ny, nz,
        nx, ny, nz
      );
      
      layer.tileBases.push8(
        u, v,
        u, v,
        u, v,
        u, v
      );
      
      layer.uvs.push8(
        0, 0,
        1, 0,
        1, 1,
        0, 1
      );
      
      layer.colors.push12(
        l0, l0, l0,
        l1, l1, l1,
        l2, l2, l2,
        l3, l3, l3
      );

      const getSway = (v: number[]) => {
        if (isLeaves(blockType) || isPlant(blockType)) {
          return (v[1] > y) ? 1.0 : 0.0;
        } else if (isWater(blockType)) {
          return 2.0;
        }
        return 0.0;
      };
      layer.sways.push4(getSway(p0!), getSway(p1!), getSway(p2!), getSway(p3!));

      if (layer === opaque && ao[0] + ao[2] < ao[1] + ao[3]) {
        layer.indices.push6(layer.offset + 1, layer.offset + 2, layer.offset + 3, layer.offset + 1, layer.offset + 3, layer.offset);
      } else {
        layer.indices.push6(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);
      }
      layer.offset += 4;
    };

    const addCross = (x: number, y: number, z: number, blockType: number, layer: any) => {
      // Deterministic random behavior based on world position
      const wx = data.chunkX * CHUNK_SIZE + x;
      const wz = data.chunkZ * CHUNK_SIZE + z;
      const hash = Math.abs(Math.sin(wx * 12.9898 + (y + WORLD_Y_OFFSET) * 78.233 + wz * 37.719) * 43758.5453) % 1;
      
      const uvsCoords = getBlockUVs(blockType)[0]; // Just use side 0
      const u = uvsCoords[0] / ATLAS_TILES;
      const v = 1 - (uvsCoords[1] + 1) / ATLAS_TILES;
      const du = 1 / ATLAS_TILES;
      const dv = 1 / ATLAS_TILES;

      const isTorch = isAnyTorch(blockType);
      const heightBase = isTorch ? 0.6 : (blockType === BLOCK.WHEAT ? 1.4 : (blockType === BLOCK.TALL_GRASS ? 1.1 : 1.0));
      const height = heightBase * (0.85 + hash * 0.3); // 85% to 115% height variation
      
      const s = isTorch ? 0.125 : 1.0; 
      const inset = (1.0 - s) / 2;
      
      // Natural horizontal jitter (Minecraft style)
      const jitterX = isTorch ? 0 : (hash - 0.5) * 0.3;
      const jitterZ = isTorch ? 0 : ((hash * 10 % 1) - 0.5) * 0.3;
      
      const px = x + jitterX;
      const pz = z + jitterZ;

      let topOffsetX = 0; let topOffsetZ = 0;
      let botOffsetX = 0; let botOffsetZ = 0;
      let botOffsetY = 0;

      if (blockType === BLOCK.TORCH_WALL_X_POS) { topOffsetX = -0.15; botOffsetX = 0.4; botOffsetY = 0.2; }
      else if (blockType === BLOCK.TORCH_WALL_X_NEG) { topOffsetX = 0.15; botOffsetX = -0.4; botOffsetY = 0.2; }
      else if (blockType === BLOCK.TORCH_WALL_Z_POS) { topOffsetZ = -0.15; botOffsetZ = 0.4; botOffsetY = 0.2; }
      else if (blockType === BLOCK.TORCH_WALL_Z_NEG) { topOffsetZ = 0.15; botOffsetZ = -0.4; botOffsetY = 0.2; }

      const p = [
        [px + inset + botOffsetX, y + botOffsetY, pz + inset + botOffsetZ], 
        [px + inset + s + botOffsetX, y + botOffsetY, pz + inset + s + botOffsetZ], 
        [px + inset + s + topOffsetX, y + height + botOffsetY, pz + inset + s + topOffsetZ], 
        [px + inset + topOffsetX, y + height + botOffsetY, pz + inset + topOffsetZ], // Diag 1
        [px + inset + s + botOffsetX, y + botOffsetY, pz + inset + botOffsetZ], 
        [px + inset + botOffsetX, y + botOffsetY, pz + inset + s + botOffsetZ], 
        [px + inset + topOffsetX, y + height + botOffsetY, pz + inset + s + topOffsetZ], 
        [px + inset + s + topOffsetX, y + height + botOffsetY, pz + inset + topOffsetZ]  // Diag 2
      ];

      const pushFace = (p0: number[], p1: number[], p2: number[], p3: number[], reverse: boolean = false) => {
        if (reverse) {
          layer.positions.push12(
            p3[0], p3[1], p3[2],
            p2[0], p2[1], p2[2],
            p1[0], p1[1], p1[2],
            p0[0], p0[1], p0[2]
          );
          layer.sways.push4(
            (isTorch || p3[1] <= y) ? 0.0 : 1.0,
            (isTorch || p2[1] <= y) ? 0.0 : 1.0,
            (isTorch || p1[1] <= y) ? 0.0 : 1.0,
            (isTorch || p0[1] <= y) ? 0.0 : 1.0
          );
          layer.tileBases.push8(u, v, u, v, u, v, u, v);
          layer.uvs.push8(
            0, 1,
            1, 1,
            1, 0,
            0, 0
          );
        } else {
          layer.positions.push12(
            p0[0], p0[1], p0[2],
            p1[0], p1[1], p1[2],
            p2[0], p2[1], p2[2],
            p3[0], p3[1], p3[2]
          );
          layer.sways.push4(
            (isTorch || p0[1] <= y) ? 0.0 : 1.0,
            (isTorch || p1[1] <= y) ? 0.0 : 1.0,
            (isTorch || p2[1] <= y) ? 0.0 : 1.0,
            (isTorch || p3[1] <= y) ? 0.0 : 1.0
          );
          layer.tileBases.push8(u, v, u, v, u, v, u, v);
          layer.uvs.push8(
            0, 0,
            1, 0,
            1, 1,
            0, 1
          );
        }
        layer.normals.push12(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0); // Up normal for simplicity
        const light = getLightLevel(x,y,z,0,0,0);
        const lightMult = isTorch ? 1.0 : Math.max(0.1, Math.pow(0.85, 15 - light));
        const color = isTorch ? 1.4 : lightMult;
        
        // Add subtle AO by darkening the bottom vertices
        const cLow = color * 0.75;
        const cHigh = color;

        if (reverse) {
          layer.colors.push12(cHigh, cHigh, cHigh, cHigh, cHigh, cHigh, cLow, cLow, cLow, cLow, cLow, cLow);
        } else {
          layer.colors.push12(cLow, cLow, cLow, cLow, cLow, cLow, cHigh, cHigh, cHigh, cHigh, cHigh, cHigh);
        }
        layer.indices.push6(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);
        layer.offset += 4;
      };

      pushFace(p[0], p[1], p[2], p[3]);
      pushFace(p[4], p[5], p[6], p[7]);
    };

    const addGreedyQuad = (x: number, y: number, z: number, w: number, h: number, dir: number, blockType: number, ao0: number, ao1: number, ao2: number, ao3: number, layer: any, light: number) => {
      const uvsCoords = getBlockUVs(blockType)[dir];
      const u = uvsCoords[0] / ATLAS_TILES;
      const v = 1 - (uvsCoords[1] + 1) / ATLAS_TILES;

      let p0, p1, p2, p3;
      let nx = 0, ny = 0, nz = 0;

      switch (dir) {
        case 0: p0 = [x + 1, y, z + w]; p1 = [x + 1, y, z]; p2 = [x + 1, y + h, z]; p3 = [x + 1, y + h, z + w]; nx = 1; break;
        case 1: p0 = [x, y, z]; p1 = [x, y, z + w]; p2 = [x, y + h, z + w]; p3 = [x, y + h, z]; nx = -1; break;
        case 2: p0 = [x, y + 1, z + h]; p1 = [x + w, y + 1, z + h]; p2 = [x + w, y + 1, z]; p3 = [x, y + 1, z]; ny = 1; break;
        case 3: p0 = [x, y, z]; p1 = [x + w, y, z]; p2 = [x + w, y, z + h]; p3 = [x, y, z + h]; ny = -1; break;
        case 4: p0 = [x, y, z + 1]; p1 = [x + w, y, z + 1]; p2 = [x + w, y + h, z + 1]; p3 = [x, y + h, z + 1]; nz = 1; break;
        case 5: p0 = [x + w, y, z]; p1 = [x, y, z]; p2 = [x, y + h, z]; p3 = [x + w, y + h, z]; nz = -1; break;
      }

      const isEmissive = blockType === BLOCK.GLOWSTONE || blockType === BLOCK.LAVA || isAnyTorch(blockType);
      const lightMult = isEmissive ? 1.0 : Math.max(0.1, Math.pow(0.85, 15 - light));
      const l0 = (layer === transparent || isEmissive) ? lightMult : ((ao0 + 1) / 4) * lightMult;
      const l1 = (layer === transparent || isEmissive) ? lightMult : ((ao1 + 1) / 4) * lightMult;
      const l2 = (layer === transparent || isEmissive) ? lightMult : ((ao2 + 1) / 4) * lightMult;
      const l3 = (layer === transparent || isEmissive) ? lightMult : ((ao3 + 1) / 4) * lightMult;
      const swayVal = isLeaves(blockType) ? 1.0 : 0.0;
      layer.sways.push4(swayVal, swayVal, swayVal, swayVal);

      layer.positions.push12(p0![0], p0![1], p0![2], p1![0], p1![1], p1![2], p2![0], p2![1], p2![2], p3![0], p3![1], p3![2]);
      layer.normals.push12(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
      layer.tileBases.push8(u, v, u, v, u, v, u, v);
      layer.uvs.push8(0, 0, w, 0, w, h, 0, h);
      layer.colors.push12(l0, l0, l0, l1, l1, l1, l2, l2, l2, l3, l3, l3);

      if (layer === opaque && ao0 + ao2 < ao1 + ao3) {
        layer.indices.push6(layer.offset + 1, layer.offset + 2, layer.offset + 3, layer.offset + 1, layer.offset + 3, layer.offset);
      } else {
        layer.indices.push6(layer.offset, layer.offset + 1, layer.offset + 2, layer.offset, layer.offset + 2, layer.offset + 3);
      }
      layer.offset += 4;
    };

    const masks = [
      new Int32Array(16 * 128 * 16), // 0: Right (+X)
      new Int32Array(16 * 128 * 16), // 1: Left (-X)
      new Int32Array(16 * 16 * 128), // 2: Top (+Y)
      new Int32Array(16 * 16 * 128), // 3: Bottom (-Y)
      new Int32Array(16 * 128 * 16), // 4: Front (+Z)
      new Int32Array(16 * 128 * 16)  // 5: Back (-Z)
    ];

    const isSolid = (x: number, y: number, z: number, dx: number, dy: number, dz: number) => {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (ny < 0 || ny >= 128) return false;
      if ((nx & ~15) === 0 && (nz & ~15) === 0) {
        return isSolidBlock(data.blocks[nx | (nz << 4) | (ny << 8)]);
      } else {
        const cdx = nx >> 4;
        const cdz = nz >> 4;
        const c = { blocks: data.neighborsBlocks[(cdx + 1) + (cdz + 1) * 3], light: data.neighborsLight[(cdx + 1) + (cdz + 1) * 3] };
        if (c) return isSolidBlock(c.blocks[(nx & 15) | ((nz & 15) << 4) | (ny << 8)]);
        return false;
      }
    };

    const getLightLevel = (x: number, y: number, z: number, dx: number, dy: number, dz: number) => {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (ny < 0 || ny >= 128) return 15;
      if ((nx & ~15) === 0 && (nz & ~15) === 0) {
        return data.light[nx | (nz << 4) | (ny << 8)];
      } else {
        const cdx = nx >> 4;
        const cdz = nz >> 4;
        const c = { blocks: data.neighborsBlocks[(cdx + 1) + (cdz + 1) * 3], light: data.neighborsLight[(cdx + 1) + (cdz + 1) * 3] };
        if (c) return c.light[(nx & 15) | ((nz & 15) << 4) | (ny << 8)];
        return 15;
      }
    };

    let startTime = performance.now();
    let iterations = 0;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const type = data.blocks[x | (z << 4) | (y << 8)];
          if (type === BLOCK.AIR) continue;
          
          const isTypeTransparent = isTransparent(type);
          const isTypeCutout = isCutout(type);
          const layer = (isTypeTransparent || isTypeCutout) ? transparent : opaque;
          
          if (isPlant(type)) {
            addCross(x, y, z, type, layer);
            continue;
          }

          const typeIsSlab = isSlab(type);
          const typeIsWater = isWater(type);
          const isFullBlock = !typeIsSlab && !typeIsWater && !isCutout(type);
          
          // Right (dir 0)
          let nType;
          if (x < 15) {
            nType = data.blocks[(x + 1) | (z << 4) | (y << 8)];
          } else {
            const c = { blocks: data.neighborsBlocks[2 + 1 * 3], light: data.neighborsLight[2 + 1 * 3] };
            const isCMeshed = !!(c && c.blocks);
            nType = isCMeshed ? c.blocks[0 | (z << 4) | (y << 8)] : (typeIsWater && y <= 62 ? BLOCK.WATER : BLOCK.AIR);
          }
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || (!typeIsSlab && isSlab(nType))) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,1,-1,0), isSolid(x,y,z,1,0,1), isSolid(x,y,z,1,-1,1));
                ao1 = getAO(isSolid(x,y,z,1,-1,0), isSolid(x,y,z,1,0,-1), isSolid(x,y,z,1,-1,-1));
                ao2 = getAO(isSolid(x,y,z,1,1,0), isSolid(x,y,z,1,0,-1), isSolid(x,y,z,1,1,-1));
                ao3 = getAO(isSolid(x,y,z,1,1,0), isSolid(x,y,z,1,0,1), isSolid(x,y,z,1,1,1));
              }
              const light = getLightLevel(x,y,z,1,0,0);
              masks[0][z + y * 16 + x * 2048] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 0, type, layer);
            }
          }
          
          // Left (dir 1)
          if (x > 0) {
            nType = data.blocks[(x - 1) | (z << 4) | (y << 8)];
          } else {
            const c = { blocks: data.neighborsBlocks[0 + 1 * 3], light: data.neighborsLight[0 + 1 * 3] };
            const isCMeshed = !!(c && c.blocks);
            nType = isCMeshed ? c.blocks[15 | (z << 4) | (y << 8)] : (typeIsWater && y <= 62 ? BLOCK.WATER : BLOCK.AIR);
          }
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || (!typeIsSlab && isSlab(nType))) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,-1,-1,0), isSolid(x,y,z,-1,0,-1), isSolid(x,y,z,-1,-1,-1));
                ao1 = getAO(isSolid(x,y,z,-1,-1,0), isSolid(x,y,z,-1,0,1), isSolid(x,y,z,-1,-1,1));
                ao2 = getAO(isSolid(x,y,z,-1,1,0), isSolid(x,y,z,-1,0,1), isSolid(x,y,z,-1,1,1));
                ao3 = getAO(isSolid(x,y,z,-1,1,0), isSolid(x,y,z,-1,0,-1), isSolid(x,y,z,-1,1,-1));
              }
              const light = getLightLevel(x,y,z,-1,0,0);
              masks[1][z + y * 16 + x * 2048] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 1, type, layer);
            }
          }
          
          // Top (dir 2)
          nType = y < 127 ? data.blocks[x | (z << 4) | ((y + 1) << 8)] : BLOCK.AIR;
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || typeIsSlab || isSlab(nType)) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,-1,1,0), isSolid(x,y,z,0,1,1), isSolid(x,y,z,-1,1,1));
                ao1 = getAO(isSolid(x,y,z,1,1,0), isSolid(x,y,z,0,1,1), isSolid(x,y,z,1,1,1));
                ao2 = getAO(isSolid(x,y,z,1,1,0), isSolid(x,y,z,0,1,-1), isSolid(x,y,z,1,1,-1));
                ao3 = getAO(isSolid(x,y,z,-1,1,0), isSolid(x,y,z,0,1,-1), isSolid(x,y,z,-1,1,-1));
              }
              const light = getLightLevel(x,y,z,0,1,0);
              masks[2][x + z * 16 + y * 256] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 2, type, layer);
            }
          }
          
          // Bottom (dir 3)
          nType = y > 0 ? data.blocks[x | (z << 4) | ((y - 1) << 8)] : BLOCK.AIR;
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || isSlab(nType)) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,-1,-1,0), isSolid(x,y,z,0,-1,-1), isSolid(x,y,z,-1,-1,-1));
                ao1 = getAO(isSolid(x,y,z,1,-1,0), isSolid(x,y,z,0,-1,-1), isSolid(x,y,z,1,-1,-1));
                ao2 = getAO(isSolid(x,y,z,1,-1,0), isSolid(x,y,z,0,-1,1), isSolid(x,y,z,1,-1,1));
                ao3 = getAO(isSolid(x,y,z,-1,-1,0), isSolid(x,y,z,0,-1,1), isSolid(x,y,z,-1,-1,1));
              }
              const light = getLightLevel(x,y,z,0,-1,0);
              masks[3][x + z * 16 + y * 256] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 3, type, layer);
            }
          }
          
          // Front (dir 4)
          if (z < 15) {
            nType = data.blocks[x | ((z + 1) << 4) | (y << 8)];
          } else {
            const c = { blocks: data.neighborsBlocks[1 + 2 * 3], light: data.neighborsLight[1 + 2 * 3] };
            const isCMeshed = !!(c && c.blocks);
            nType = isCMeshed ? c.blocks[x | (0 << 4) | (y << 8)] : (typeIsWater && y <= 62 ? BLOCK.WATER : BLOCK.AIR);
          }
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || (!typeIsSlab && isSlab(nType))) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,-1,0,1), isSolid(x,y,z,0,-1,1), isSolid(x,y,z,-1,-1,1));
                ao1 = getAO(isSolid(x,y,z,1,0,1), isSolid(x,y,z,0,-1,1), isSolid(x,y,z,1,-1,1));
                ao2 = getAO(isSolid(x,y,z,1,0,1), isSolid(x,y,z,0,1,1), isSolid(x,y,z,1,1,1));
                ao3 = getAO(isSolid(x,y,z,-1,0,1), isSolid(x,y,z,0,1,1), isSolid(x,y,z,-1,1,1));
              }
              const light = getLightLevel(x,y,z,0,0,1);
              masks[4][x + y * 16 + z * 2048] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 4, type, layer);
            }
          }
          
          // Back (dir 5)
          if (z > 0) {
            nType = data.blocks[x | ((z - 1) << 4) | (y << 8)];
          } else {
            const c = { blocks: data.neighborsBlocks[1 + 0 * 3], light: data.neighborsLight[1 + 0 * 3] };
            const isCMeshed = !!(c && c.blocks);
            nType = isCMeshed ? c.blocks[x | (15 << 4) | (y << 8)] : (typeIsWater && y <= 62 ? BLOCK.WATER : BLOCK.AIR);
          }
          if (nType === BLOCK.AIR || (isTransparent(nType) && !(typeIsWater && isWater(nType)) && nType !== type) || isCutout(nType) || (!typeIsSlab && isSlab(nType))) {
            if (isFullBlock) {
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!performanceMode) {
                ao0 = getAO(isSolid(x,y,z,1,0,-1), isSolid(x,y,z,0,-1,-1), isSolid(x,y,z,1,-1,-1));
                ao1 = getAO(isSolid(x,y,z,-1,0,-1), isSolid(x,y,z,0,-1,-1), isSolid(x,y,z,-1,-1,-1));
                ao2 = getAO(isSolid(x,y,z,-1,0,-1), isSolid(x,y,z,0,1,-1), isSolid(x,y,z,-1,1,-1));
                ao3 = getAO(isSolid(x,y,z,1,0,-1), isSolid(x,y,z,0,1,-1), isSolid(x,y,z,1,1,-1));
              }
              const light = getLightLevel(x,y,z,0,0,-1);
              masks[5][x + y * 16 + z * 2048] = type | (ao0 << 10) | (ao1 << 12) | (ao2 << 14) | (ao3 << 16) | (layer === transparent ? 1 << 18 : 0) | (light << 19);
            } else {
              addFace(x, y, z, 5, type, layer);
            }
          }
          
          iterations++;
          if (iterations % 256 === 0 && performance.now() - startTime > 1) {
            
            startTime = performance.now();
          }
        }
      }
    }

    // Greedy mesh the masks
    for (let dir = 0; dir < 6; dir++) {
      const mask = masks[dir];
      let sliceMax, iMax, jMax;
      if (dir === 0 || dir === 1) { sliceMax = 16; iMax = 128; jMax = 16; } // X slices. i=y, j=z
      else if (dir === 2 || dir === 3) { sliceMax = 128; iMax = 16; jMax = 16; } // Y slices. i=z, j=x
      else { sliceMax = 16; iMax = 128; jMax = 16; } // Z slices. i=y, j=x

      for (let slice = 0; slice < sliceMax; slice++) {
        for (let i = 0; i < iMax; i++) {
          for (let j = 0; j < jMax; ) {
            const idx = j + i * jMax + slice * jMax * iMax;
            const val = mask[idx];
            if (val !== 0) {
              let w = 1;
              while (j + w < jMax && mask[j + w + i * jMax + slice * jMax * iMax] === val) {
                w++;
              }
              let h = 1;
              let done = false;
              while (i + h < iMax) {
                for (let k = 0; k < w; k++) {
                  if (mask[j + k + (i + h) * jMax + slice * jMax * iMax] !== val) {
                    done = true;
                    break;
                  }
                }
                if (done) break;
                h++;
              }

              const blockType = val & 0x3FF;
              const ao0 = (val >> 10) & 0x3;
              const ao1 = (val >> 12) & 0x3;
              const ao2 = (val >> 14) & 0x3;
              const ao3 = (val >> 16) & 0x3;
              const isTransp = (val >> 18) & 0x1;
              const light = (val >> 19) & 0xF;
              const layer = isTransp ? transparent : opaque;

              let x, y, z;
              if (dir === 0 || dir === 1) { x = slice; y = i; z = j; }
              else if (dir === 2 || dir === 3) { y = slice; z = i; x = j; }
              else { z = slice; y = i; x = j; }

              addGreedyQuad(x, y, z, w, h, dir, blockType, ao0, ao1, ao2, ao3, layer, light);

              for (let di = 0; di < h; di++) {
                for (let dj = 0; dj < w; dj++) {
                  mask[j + dj + (i + di) * jMax + slice * jMax * iMax] = 0;
                }
              }
              j += w;
            } else {
              j++;
            }
          }
        }
      }
    }

    const mapLayer = (layer: any) => {
      if (layer.offset === 0) return null;
      return {
        positions: layer.positions.toArray(),
        normals: layer.normals.toArray(),
        uvs: layer.uvs.toArray(),
        colors: layer.colors.toArray(),
        indices: layer.indices.toArray(),
        tileBases: layer.tileBases.toArray(),
        sways: layer.sways.toArray()
      };
    };

    return {
      taskId: data.taskId,
      opaque: mapLayer(opaque),
      transparent: mapLayer(transparent)
    };
  
}
