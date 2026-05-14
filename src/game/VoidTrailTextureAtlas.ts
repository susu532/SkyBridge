import * as THREE from 'three';
import { BLOCK_UVS } from "./TextureAtlasData";
import { ITEM_COLORS } from './Constants';
import { ItemType } from './Inventory';
export const ATLAS_TILES = 32;

let cachedVoidtrailTexture: THREE.Texture | null = null;

export function createVoidtrailTextureAtlas(): THREE.Texture {
  if (cachedVoidtrailTexture) return cachedVoidtrailTexture;

  const canvas = document.createElement('canvas');
  const size = 16;
  const tiles = ATLAS_TILES;
  canvas.width = size * tiles;
  canvas.height = size * tiles;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const rgbToHex = (r: number, g: number, b: number) => `#${((1 << 24) + (Math.max(0, Math.min(255, r)) << 16) + (Math.max(0, Math.min(255, g)) << 8) + Math.max(0, Math.min(255, b))).toString(16).slice(1)}`;
  const hexToRgb = (hex: string) => {
      let r = 255, g = 0, b = 255;
      if (typeof hex === 'string') {
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length >= 7) {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
      }
      return { r: isNaN(r) ? 255 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 255 : b };
  };

  const drawBeveledTile = (x: number, y: number, colorHex: string, hasFace: boolean = false) => {
    let { r, g, b } = hexToRgb(colorHex);
    // Be a bit more vibrant
    r = Math.min(255, r * 1.1);
    g = Math.min(255, g * 1.1);
    b = Math.min(255, b * 1.1);
    const color = rgbToHex(Math.round(r), Math.round(g), Math.round(b));

    const outline = rgbToHex(Math.round(r * 0.4), Math.round(g * 0.4), Math.round(b * 0.4));
    const shadow = rgbToHex(Math.round(r * 0.7), Math.round(g * 0.7), Math.round(b * 0.7));
    const highlight = rgbToHex(
      Math.min(255, Math.max(40, Math.round(r * 1.5))), 
      Math.min(255, Math.max(40, Math.round(g * 1.5))), 
      Math.min(255, Math.max(40, Math.round(b * 1.5)))
    );

    // Outer outline (cel-shaded toy look)
    ctx.fillStyle = outline;
    ctx.fillRect(x * size, y * size, size, size);

    // Main fill
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

    // Bevel highlights & shadows for plastic look
    ctx.fillStyle = highlight;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 1); // Top inner
    ctx.fillRect(x * size + 1, y * size + 2, 1, size - 3); // Left inner

    ctx.fillStyle = shadow;
    ctx.fillRect(x * size + 1, y * size + size - 2, size - 2, 1); // Bottom inner
    ctx.fillRect(x * size + size - 2, y * size + 2, 1, size - 3); // Right inner

    if (hasFace) {
       // Kawaii Face
       ctx.fillStyle = '#000000';
       // Eyes
       ctx.fillRect(x * size + 4, y * size + 6, 2, 2);
       ctx.fillRect(x * size + 10, y * size + 6, 2, 2);
       // Mouth
       ctx.fillRect(x * size + 6, y * size + 9, 1, 1);
       ctx.fillRect(x * size + 9, y * size + 9, 1, 1);
       ctx.fillRect(x * size + 7, y * size + 10, 2, 1);
       // Blush
       ctx.fillStyle = '#ff88aa';
       ctx.fillRect(x * size + 2, y * size + 7, 2, 1);
       ctx.fillRect(x * size + 12, y * size + 7, 2, 1);
    }
  };

  const VOIDTRAIL_PALETTE = [
    '#FF69B4', // hotpink
    '#000000', // black
    '#FFFFFF', // white
    '#800080', // purple
    '#32CD32', // limegreen
    '#00FFFF', // cyan
    '#FF00FF'  // magenta
  ];

  for (let blockId=0; blockId<BLOCK_UVS.length; blockId++) {
    const uvs = BLOCK_UVS[blockId];
    if (!uvs) continue;
    
    let color = VOIDTRAIL_PALETTE[blockId % VOIDTRAIL_PALETTE.length];
    
    if (blockId === ItemType.CONCRETE_WHITE) color = '#FFFFFF';
    else if (blockId === ItemType.CONCRETE_BLACK) color = '#000000';
    else if (blockId === ItemType.CONCRETE_PINK) color = '#FF69B4'; // hotpink
    else if (blockId === ItemType.CONCRETE_PURPLE) color = '#800080'; // purple
    else if (blockId === ItemType.CONCRETE_LIME) color = '#32CD32'; // limegreen
    else if (blockId === ItemType.CONCRETE_MAGENTA) color = '#FF00FF'; // magenta

    const drawnOptions = new Set<string>();
    for (let face = 0; face < 6; face++) {
       const [tx, ty] = uvs[face];
       const key = `${tx},${ty}`;
       if (drawnOptions.has(key)) continue;
       drawnOptions.add(key);

       let hasFace = false;
       if (blockId === ItemType.GLOWSTONE || blockId === ItemType.BLUE_STONE) hasFace = true;
       // We can give the kawaii face to "special" interactable blocks 
       if (blockId === ItemType.CRAFTING_TABLE || blockId === ItemType.FURNACE) hasFace = true;

       if (tx === 0 && ty === 2) { // Water
          ctx.clearRect(tx*size, ty*size, size, size);
          ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
          ctx.fillRect(tx*size, ty*size, size, size);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fillRect(tx*size + 3, ty*size + 3, 4, 1);
          ctx.fillRect(tx*size + 2, ty*size + 4, 1, 2);
       } else if (tx === 1 && ty === 2) { // Glass
          ctx.clearRect(tx*size, ty*size, size, size);
          ctx.fillStyle = 'rgba(200, 255, 255, 0.3)';
          ctx.fillRect(tx*size, ty*size, size, size);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.fillRect(tx*size + 2, ty*size + 2, 4, 1);
          ctx.fillRect(tx*size + 2, ty*size + 3, 1, 3);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.strokeRect(tx*size + 1, ty*size + 1, size - 2, size - 2);
       } else {
          drawBeveledTile(tx, ty, color, hasFace);
       }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  cachedVoidtrailTexture = texture;
  return texture;
}
