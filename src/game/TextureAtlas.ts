import * as THREE from 'three';
import { BLOCK_UVS } from "./TextureAtlasData";
export { createBreakingTexture } from "./TextureAtlasData";
export { isTransparent, isCutout, isSlab, isSolidBlock, isLightEmitting, isPlant, isAnyTorch, isFlatItem, isLeaves } from "./TextureAtlasData";
import { ITEM_COLORS } from './Constants';

import { ItemType, isChest } from './Inventory';
export const BLOCK = ItemType as any;
export { isChest };

export const ATLAS_TILES = 32;

export const isWater = (blockType: number) => {
  return blockType === BLOCK.WATER || (blockType >= BLOCK.WATER_1 && blockType <= BLOCK.WATER_7);
};

export const isLava = (blockType: number) => {
  return blockType === BLOCK.LAVA;
};

// Generate a simple texture atlas
let cachedTexture: THREE.Texture | null = null;
export function createTextureAtlas(): THREE.Texture {
  if (cachedTexture) return cachedTexture;

  const canvas = document.createElement('canvas');
  const size = 16;
  const tiles = ATLAS_TILES; // 8x8 atlas
  canvas.width = size * tiles;
  canvas.height = size * tiles;
  const ctx = canvas.getContext('2d')!;

  // Helper to draw a tile
  const drawTile = (x: number, y: number, color: string, noiseColor: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * size, y * size, size, size);
    
    // Add more noise for a detailed look
    ctx.fillStyle = noiseColor;
    for (let i = 0; i < 40; i++) {
      const nx = x * size + Math.random() * size;
      const ny = y * size + Math.random() * size;
      ctx.fillRect(nx, ny, 1, 1);
    }
  };

  // 0,0: Dirt
  drawTile(0, 0, (ITEM_COLORS[BLOCK.DIRT] || '#5c4033'), '#3d2b22');
  // 1,0: Grass top (Refined with clovers and pebbles)
  drawTile(1, 0, (ITEM_COLORS[BLOCK.GRASS] || '#41980a'), '#2d6a07');
  ctx.fillStyle = '#4fa81a'; // Lighter spots
  for(let i=0; i<5; i++) ctx.fillRect(1 * size + Math.random()*14, Math.random()*14, 2, 2);
  ctx.fillStyle = '#ffffff66'; // Tiny white flowers/pebbles
  for(let i=0; i<3; i++) ctx.fillRect(1 * size + Math.random()*15, Math.random()*15, 1, 1);
  ctx.fillStyle = '#2d6a0766'; // Occasional clover shape
  for(let i=0; i<2; i++) {
     const cx = 1 * size + 4 + Math.random()*8;
     const cy = 4 + Math.random()*8;
     ctx.fillRect(cx, cy, 2, 1); ctx.fillRect(cx + 0.5, cy - 0.5, 1, 2);
  }
  // 2,0: Grass side
  drawTile(2, 0, (ITEM_COLORS[BLOCK.DIRT] || '#5c4033'), '#3d2b22');
  ctx.fillStyle = (ITEM_COLORS[BLOCK.GRASS] || '#41980a');
  ctx.fillRect(2 * size, 0, size, size * 0.3); // Grass on top
  // 3,0: Stone
  drawTile(3, 0, (ITEM_COLORS[BLOCK.FURNACE] || '#7d7d7d'), '#5a5a5a');
  
  // 0,1: Wood side
  drawTile(0, 1, (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29'), '#4a3318');
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SPRUCE_LOG] || '#3d2811');
  ctx.fillRect(0 * size + 4, 1 * size, 2, size);
  ctx.fillRect(0 * size + 10, 1 * size, 2, size);
  // 1,1: Wood top
  drawTile(1, 1, (ITEM_COLORS[BLOCK.CRAFTING_TABLE] || '#8f6b42'), (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29'));
  ctx.strokeStyle = '#4a3318';
  ctx.beginPath(); ctx.arc(1.5*size, 1.5*size, 4, 0, Math.PI*2); ctx.stroke();
  
  // 2,1: Leaves
  drawTile(2, 1, (ITEM_COLORS[BLOCK.LEAVES] || '#2d6a14'), '#1e4a0d');
  
  // 3,1: Sand
  drawTile(3, 1, '#dbca98', '#c9b784');

  // 0,2: Water
  ctx.fillStyle = 'rgba(63, 118, 228, 0.75)'; 
  ctx.fillRect(0 * size, 2 * size, size, size);
  
  // 1,2: Glass
  ctx.clearRect(1 * size, 2 * size, size, size);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(1 * size, 2 * size, size, size);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.strokeRect(1 * size + 1, 2 * size + 1, size - 2, size - 2);
  ctx.beginPath();
  ctx.moveTo(1*size + 4, 2*size + 4); ctx.lineTo(1*size + 6, 2*size + 6);
  ctx.moveTo(1*size + 10, 2*size + 10); ctx.lineTo(1*size + 12, 2*size + 12);
  ctx.stroke();

  // 2,2: Brick
  drawTile(2, 2, '#964b00', '#7a3d00');
  ctx.fillStyle = '#ffffff33';
  ctx.fillRect(2 * size, 2 * size + 7, size, 1);
  ctx.fillRect(2 * size + 7, 2 * size, 1, size);

  // 0,3: Blue Stone (Mithril-like)
  drawTile(0, 3, '#4facfe', '#00f2fe');
  // 1,3: Red Stone (Ruby-like)
  drawTile(1, 3, '#ff0844', '#ffb199');
  // 2,3: Planks
  drawTile(2, 3, '#9c7c5c', '#7c5c3c');
  ctx.fillStyle = '#00000022';
  for(let i=0; i<4; i++) ctx.fillRect(2 * size, 3 * size + i*4, size, 1);
  ctx.fillRect(2 * size + 8, 3 * size, 1, size);
  // 3,2: Snow
  drawTile(3, 2, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#e0e0e0');

  // 3,3: Stick (Item only)
  ctx.clearRect(3 * size, 3 * size, size, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
  for (let i = 2; i < 14; i++) ctx.fillRect(3 * size + i, 3 * size + 15 - i, 2, 2);

  // --- NEW BLOCKS ---
  // 4,0: Tall Grass (Refined Blade approach)
  ctx.clearRect(4 * size, 0, size, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.GRASS] || '#41980a');
  for(let i=0; i<12; i++) {
    const rx = 1 + (i * 1.2) % 14;
    const rh = 6 + (Math.sin(i * 1.5) * 4) + 6;
    ctx.fillStyle = i % 2 === 0 ? (ITEM_COLORS[BLOCK.GRASS] || '#41980a') : '#2d6a07'; // Shaded blades
    ctx.fillRect(4 * size + rx, size - rh, 2, rh);
  }

  // 5,0: Flower Red (Refined Petals)
  ctx.clearRect(5 * size, 0, size, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.LEAVES] || '#2d6a14'); // Stem
  ctx.fillRect(5 * size + 7, 10, 2, 6);
  ctx.fillStyle = '#990000'; // Darker petal base
  ctx.fillRect(5 * size + 4, 6, 8, 4);
  ctx.fillRect(5 * size + 6, 4, 4, 8);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.FLOWER_RED] || '#ff0000'); // Bright Petals
  ctx.fillRect(5 * size + 5, 5, 6, 6);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.FLOWER_YELLOW] || '#ffcc00'); // Yellow center
  ctx.fillRect(5 * size + 7, 7, 2, 2);

  // 6,0: Flower Yellow (Refined Dandelion)
  ctx.clearRect(6 * size, 0, size, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.LEAVES] || '#2d6a14');
  ctx.fillRect(6 * size + 7, 10, 2, 6);
  ctx.fillStyle = '#ccaa00'; // Shaded petals
  ctx.beginPath(); ctx.arc(6 * size + 8, 7, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffdf00'; // Bright Petals
  ctx.beginPath(); ctx.arc(6 * size + 8, 7, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffffff88'; // Highlights
  ctx.fillRect(6 * size + 6, 5, 1, 1);
  ctx.fillRect(6 * size + 9, 6, 1, 1);

  // 7,0: Tall Dark Green Grass (Refined long blades)
  ctx.clearRect(7 * size, 0, size, size);
  ctx.fillStyle = '#1a3a1a';
  for(let i=0; i<10; i++) {
    const xOff = 2 + (i * 1.3) % 12;
    const h = 12 + Math.sin(i * 0.7) * 4;
    ctx.fillStyle = i % 2 === 0 ? '#1a3a1a' : '#2d4a2d';
    ctx.fillRect(7 * size + xOff, size - h, 2, h);
  }

  // 4,1: Birch Log Side
  drawTile(4, 1, (ITEM_COLORS[BLOCK.BIRCH_LOG] || '#d7d7d7'), '#b0b0b0');
  ctx.fillStyle = '#333333';
  for(let i=0; i<5; i++) ctx.fillRect(4 * size + Math.random()*12, 1 * size + Math.random()*16, 3, 1);

  // 5,1: Birch Log Top
  drawTile(5, 1, (ITEM_COLORS[BLOCK.IRON_SHOVEL] || '#e8e8e8'), (ITEM_COLORS[BLOCK.BIRCH_LOG] || '#d7d7d7'));
  ctx.strokeStyle = '#b0b0b0';
  ctx.beginPath(); ctx.arc(5.5*size, 1.5*size, 4, 0, Math.PI*2); ctx.stroke();

  // 6,1: Birch Leaves
  drawTile(6, 1, (ITEM_COLORS[BLOCK.BIRCH_LEAVES] || '#507d2a'), '#3a5a1e');

  // 4,2: Spruce Log Side
  drawTile(4, 2, (ITEM_COLORS[BLOCK.SPRUCE_LOG] || '#3d2811'), '#2a1b0b');
  // 5,2: Spruce Log Top
  drawTile(5, 2, '#4d3318', (ITEM_COLORS[BLOCK.SPRUCE_LOG] || '#3d2811'));
  // 6,2: Spruce Leaves
  drawTile(6, 2, (ITEM_COLORS[BLOCK.SPRUCE_LEAVES] || '#1a360e'), '#0d1d07');

  // 7,1: Cactus Side (Refined)
  drawTile(7, 1, (ITEM_COLORS[BLOCK.CACTUS] || '#007700'), '#005500');
  ctx.fillStyle = '#0a440a'; // Ridges
  ctx.fillRect(7 * size + 3, 1 * size, 2, size);
  ctx.fillRect(7 * size + 11, 1 * size, 2, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'); // Prickles
  for(let i=0; i<8; i++) {
    ctx.fillRect(7 * size + 2, 1 * size + i*2, 1, 1);
    ctx.fillRect(7 * size + 14, 1 * size + i*2 + 1, 1, 1);
    ctx.fillRect(7 * size + 8, 1 * size + i*2, 1, 1);
  }

  // 7,2: Cactus Top (Refined)
  drawTile(7, 2, '#009900', (ITEM_COLORS[BLOCK.CACTUS] || '#007700'));
  ctx.fillStyle = '#005500';
  ctx.beginPath(); ctx.arc(7.5*size, 2.5*size, 6, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#004400';
  ctx.beginPath(); ctx.moveTo(7.5*size - 6, 2.5*size); ctx.lineTo(7.5*size + 6, 2.5*size); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7.5*size, 2.5*size - 6); ctx.lineTo(7.5*size, 2.5*size + 6); ctx.stroke();

  // --- MUSHROOMS ---
  // 5,7: Red Mushroom
  ctx.clearRect(5 * size, 7 * size, size, size);
  ctx.fillStyle = '#990000'; // Cap edge
  ctx.fillRect(5 * size + 2, 7 * size + 4, 12, 6);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.FLOWER_RED] || '#ff0000'); // Cap center
  ctx.fillRect(5 * size + 3, 7 * size + 3, 10, 6);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'); // White spots
  ctx.fillRect(5 * size + 5, 7 * size + 4, 2, 2);
  ctx.fillRect(5 * size + 10, 7 * size + 6, 2, 2);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.ARROW] || '#dddddd'); // Stem
  ctx.fillRect(5 * size + 7, 7 * size + 10, 2, 6);

  // 6,7: Brown Mushroom
  ctx.clearRect(6 * size, 7 * size, size, size);
  ctx.fillStyle = '#4a3318'; // Dark Brown Cap
  ctx.fillRect(6 * size + 2, 7 * size + 6, 12, 4);
  ctx.fillRect(6 * size + 4, 7 * size + 4, 8, 6);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29'); // Lighter Brown highlight
  ctx.fillRect(6 * size + 5, 7 * size + 5, 6, 2);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.ARROW] || '#dddddd'); // Stem
  ctx.fillRect(6 * size + 7, 7 * size + 10, 2, 6);

  // 7,3: Dead Bush (Refined)
  ctx.clearRect(7 * size, 3 * size, size, size);
  ctx.strokeStyle = (ITEM_COLORS[BLOCK.STICK] || '#8b6240');
  ctx.lineWidth = 1;
  // Tangled branches
  ctx.beginPath();
  ctx.moveTo(7*size + 8, 3*size + 16); ctx.lineTo(7*size + 8, 3*size + 10);
  ctx.lineTo(7*size + 4, 3*size + 6); ctx.moveTo(7*size + 8, 3*size + 10);
  ctx.lineTo(7*size + 12, 3*size + 7); ctx.moveTo(7*size + 6, 3*size + 8);
  ctx.lineTo(7*size + 10, 3*size + 4); ctx.stroke();
  ctx.fillStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
  ctx.fillRect(7 * size + 7, 3 * size + 12, 2, 4); // Main stem base

  // 6,3: Ice
  ctx.fillStyle = 'rgba(150, 200, 255, 0.8)';
  ctx.fillRect(6 * size, 3 * size, size, size);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(6 * size + 2, 3 * size + 2, 4, 1);
  ctx.fillRect(6 * size + 10, 3 * size + 12, 3, 1);

  // 5,3: Sandstone
  drawTile(5, 3, (ITEM_COLORS[BLOCK.SAND] || '#d2b48c'), '#c2a47c');
  ctx.fillStyle = '#b89b74';
  ctx.fillRect(5 * size, 3 * size + 14, size, 2);

  // --- BEG_GEN ---

  // --- TOOLS & WEAPONS ---
  const drawTool = (x: number, y: number, isPickaxe: boolean, matColor: string, tier: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    
    // Palette generation based on matColor
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const rgbToHex = (r: number, g: number, b: number) => `#${((1 << 24) + (Math.max(0, Math.min(255, r)) << 16) + (Math.max(0, Math.min(255, g)) << 8) + Math.max(0, Math.min(255, b))).toString(16).slice(1)}`;
    
    const base = hexToRgb(matColor);
    const highlight = rgbToHex(base.r + 50, base.g + 50, base.b + 50);
    const shadow = rgbToHex(base.r - 50, base.g - 50, base.b - 50);
    const outline = rgbToHex(base.r - 100, base.g - 100, base.b - 100);
    
    const handleDark = (ITEM_COLORS[BLOCK.SPRUCE_LOG] || '#3d2811');
    const handleMid = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
    const handleLight = (ITEM_COLORS[BLOCK.CRAFTING_TABLE] || '#8f6b42');
    const handleOutline = '#1a1108';

    // 1. Draw Stick (Handle)
    // Detailed stick with diagonal banding
    for (let i = 0; i < 9; i++) {
        const px = x * size + i + 1;
        const py = y * size + 14 - i;
        
        ctx.fillStyle = handleOutline;
        ctx.fillRect(px, py + 1, 2, 2); // shadow/outline
        
        ctx.fillStyle = (i % 3 === 0) ? handleDark : (i % 3 === 1) ? handleMid : handleLight;
        ctx.fillRect(px, py, 1, 1);
        
        // Grip wrap for higher tiers
        if (tier >= 2 && i > 2 && i < 6) {
           ctx.fillStyle = tier === 4 ? (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1') : (tier === 3 ? (ITEM_COLORS[BLOCK.SKYCOIN] || '#ffd700') : '#111111');
           ctx.fillRect(px, py, 1, 1);
        }
    }

    if (isPickaxe) {
        // --- PICKAXE HEAD ---
        // Curved head shape
        const drawPixel = (dx: number, dy: number, color: string) => {
            ctx.fillStyle = color;
            ctx.fillRect(x * size + dx, y * size + dy, 1, 1);
        };

        // Head coordinates
        const headPixels = [
            [8,4], [7,4], [6,5], [5,5], [4,6], [3,7], [2,8], [2,9], // Left arm
            [9,4], [10,4], [11,5], [12,5], [13,6], [14,7], [15,8], [15,9] // Right arm
        ];

        // Outline
        ctx.fillStyle = outline;
        headPixels.forEach(([px, py]) => {
            ctx.fillRect(x*size + px - 1, y*size + py - 1, 3, 3);
        });

        // Main body
        ctx.fillStyle = matColor;
        headPixels.forEach(([px, py]) => {
            ctx.fillRect(x*size + px, y*size + py, 1, 1);
        });
        
        // Highlights
        ctx.fillStyle = highlight;
        ctx.fillRect(x*size + 6, y*size + 5, 3, 1);
        ctx.fillRect(x*size + 9, y*size + 5, 3, 1);
        ctx.fillRect(x*size + 14, y*size + 7, 1, 1);
        ctx.fillRect(x*size + 3, y*size + 7, 1, 1);

        // Center hub
        ctx.fillStyle = outline;
        ctx.fillRect(x*size + 7, y*size + 3, 3, 3);
        ctx.fillStyle = matColor;
        ctx.fillRect(x*size + 8, y*size + 4, 1, 1);
        
        // Shiny spark for high tiers
        if (tier >= 3) {
            ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
            ctx.fillRect(x*size + 8, y*size + 4, 1, 1);
            ctx.fillRect(x*size + 4, y*size + 6, 1, 1);
            ctx.fillRect(x*size + 13, y*size + 6, 1, 1);
        }

    } else {
        // --- SWORD ---
        // Guard (Hilt)
        const guardOutline = [
            [3,10], [4,10], [5,10], [6,10], [7,10], [8,10], [9,10], [10,10],
            [9,9], [8,8], [7,7], [6,6], // handle connection
        ];
        
        ctx.fillStyle = handleOutline;
        // Draw a proper crossguard
        ctx.fillRect(x*size + 3, y*size + 9, 8, 3);
        
        // Guard color
        ctx.fillStyle = (tier === 0) ? (ITEM_COLORS[BLOCK.WOODEN_PICKAXE] || '#8b5a2b') : (tier === 1) ? (ITEM_COLORS[BLOCK.STONE] || '#888888') : (tier === 2) ? (ITEM_COLORS[BLOCK.IRON_PICKAXE] || '#e5e4e2') : (tier === 3) ? (ITEM_COLORS[BLOCK.SKYCOIN] || '#ffd700') : (ITEM_COLORS[BLOCK.DIAMOND_PICKAXE] || '#b9f2ff');
        ctx.fillRect(x*size + 4, y*size + 10, 6, 1);
        
        // Blade (Diagonal)
        const bladeLength = tier >= 3 ? 11 : 9;
        for (let i = 0; i < bladeLength; i++) {
            const bx = x * size + 6 + i;
            const by = y * size + 8 - i;
            
            // Blade Outline - thicker at base
            ctx.fillStyle = outline;
            ctx.fillRect(bx - 1, by - 1, (i < 2 ? 4 : 3), (i < 2 ? 4 : 3));
        }
        for (let i = 0; i < bladeLength; i++) {
            const bx = x * size + 6 + i;
            const by = y * size + 8 - i;
            
            // Blade core
            ctx.fillStyle = matColor;
            ctx.fillRect(bx, by, 2, 2);
            
            // Inner fuller (blood groove) for higher tiers
            if (tier >= 2 && i > 1 && i < bladeLength - 1) {
                ctx.fillStyle = shadow;
                ctx.fillRect(bx, by, 1, 1);
            }
            
            // Highlight edge
            ctx.fillStyle = highlight;
            ctx.fillRect(bx, by, 1, 1);
            
            // Shadow under-edge
            if (i < bladeLength - 1) {
                ctx.fillStyle = shadow;
                ctx.fillRect(bx + 1, by + 1, 1, 1);
            }
        }
        
        // Tip
        ctx.fillStyle = highlight;
        ctx.fillRect(x*size + 6 + bladeLength, y*size + 8 - bladeLength, 1, 1);
        
        // Handle Pommel
        ctx.fillStyle = outline;
        ctx.fillRect(x*size - 1, y*size + 14, 4, 4);
        ctx.fillStyle = (tier >= 3) ? matColor : handleDark;
        ctx.fillRect(x*size, y*size + 15, 2, 2);
    }
  };

  const drawShovel = (x: number, y: number, color: string, tier: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    const matColor = color;
    
    // Palette generation based on matColor
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const rgbToHex = (r: number, g: number, b: number) => `#${((1 << 24) + (Math.max(0, Math.min(255, r)) << 16) + (Math.max(0, Math.min(255, g)) << 8) + Math.max(0, Math.min(255, b))).toString(16).slice(1)}`;
    
    const base = hexToRgb(matColor);
    const highlight = rgbToHex(base.r + 50, base.g + 50, base.b + 50);
    const shadow = rgbToHex(base.r - 50, base.g - 50, base.b - 50);
    const outline = rgbToHex(base.r - 100, base.g - 100, base.b - 100);
    
    const handleOutline = '#1a1108';
    const handleMid = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');

    // Handle
    ctx.fillStyle = handleMid;
    for(let i=0; i<12; i++) {
        const px = x*size + i;
        const py = y*size + 15 - i;
        ctx.fillStyle = handleOutline;
        ctx.fillRect(px, py + 1, 2, 2);
        ctx.fillStyle = handleMid;
        ctx.fillRect(px, py, 1, 1);
    }
    
    // Head outline
    ctx.fillStyle = outline;
    ctx.fillRect(x*size + 10, y*size + 2, 4, 6);
    ctx.fillRect(x*size + 9, y*size + 3, 6, 4);
    
    // Head main
    ctx.fillStyle = matColor;
    ctx.fillRect(x*size + 11, y*size + 3, 2, 4);
    ctx.fillRect(x*size + 10, y*size + 4, 4, 2);
    
    // Highlight
    ctx.fillStyle = highlight;
    ctx.fillRect(x*size + 10, y*size + 3, 1, 1);
  };

  const drawAxe = (x: number, y: number, color: string, tier: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    const matColor = color;
    
    // Palette generation based on matColor
    const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };
    const rgbToHex = (r: number, g: number, b: number) => `#${((1 << 24) + (Math.max(0, Math.min(255, r)) << 16) + (Math.max(0, Math.min(255, g)) << 8) + Math.max(0, Math.min(255, b))).toString(16).slice(1)}`;
    
    const base = hexToRgb(matColor);
    const highlight = rgbToHex(base.r + 50, base.g + 50, base.b + 50);
    const shadow = rgbToHex(base.r - 50, base.g - 50, base.b - 50);
    const outline = rgbToHex(base.r - 100, base.g - 100, base.b - 100);
    
    const handleOutline = '#1a1108';
    const handleMid = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
    
    // Handle
    for(let i=0; i<14; i++) {
        const px = x*size + i;
        const py = y*size + 15 - i;
        ctx.fillStyle = handleOutline;
        ctx.fillRect(px, py + 1, 2, 2);
        ctx.fillStyle = handleMid;
        ctx.fillRect(px, py, 1, 1);
    }
    
    // Head outline
    ctx.fillStyle = outline;
    ctx.fillRect(x*size + 7, y*size + 1, 7, 7);
    
    // Head main
    ctx.fillStyle = matColor;
    ctx.fillRect(x*size + 8, y*size + 2, 5, 5);
    ctx.fillRect(x*size + 13, y*size + 3, 1, 3); // Beard/tip
    
    // Highlights
    ctx.fillStyle = highlight;
    ctx.fillRect(x*size + 8, y*size + 2, 1, 1);
    ctx.fillRect(x*size + 12, y*size + 3, 1, 1);
    
    // Shadow
    ctx.fillStyle = shadow;
    ctx.fillRect(x*size + 8, y*size + 6, 5, 1);
  };

  const drawFood = (x: number, y: number, color: string, isApple: boolean) => {
    ctx.clearRect(x * size, y * size, size, size);
    if(isApple) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x*size + 8, y*size + 9, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#4a2b00'; // Stem
      ctx.fillRect(x*size + 7, y*size + 2, 2, 3);
      ctx.fillStyle = '#ffffff66'; // Shine
      ctx.fillRect(x*size + 10, y*size + 6, 2, 2);
    } else {
      // Steak shape
      ctx.fillStyle = color;
      ctx.fillRect(x*size + 4, y*size + 4, 8, 8);
      ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'); // Bone
      ctx.fillRect(x*size + 2, y*size + 6, 4, 2);
      ctx.fillStyle = '#00000022'; // Grill marks
      ctx.fillRect(x*size + 5, y*size + 6, 6, 1);
      ctx.fillRect(x*size + 5, y*size + 9, 6, 1);
    }
  };

  drawTool(0, 28, true, (ITEM_COLORS[BLOCK.WOODEN_PICKAXE] || '#8b5a2b'), 0); // Wood Pick
  drawTool(1, 28, true, '#9a9a9a', 1); // Stone Pick
  drawTool(2, 28, true, '#e6e6e6', 2); // Iron Pick
  drawTool(3, 28, true, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), 3); // Gold Pick
  drawTool(4, 28, true, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), 4); // Diamond Pick

  drawTool(0, 29, false, (ITEM_COLORS[BLOCK.WOODEN_PICKAXE] || '#8b5a2b'), 0); // Wood Sword
  drawTool(1, 29, false, '#9a9a9a', 1); // Stone Sword
  drawTool(2, 29, false, '#e6e6e6', 2); // Iron Sword
  drawTool(3, 29, false, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), 3); // Gold Sword
  drawTool(4, 29, false, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), 4); // Diamond Sword

  drawShovel(0, 30, (ITEM_COLORS[BLOCK.WOODEN_PICKAXE] || '#8b5a2b'), 0);
  drawShovel(1, 30, '#9a9a9a', 1);
  drawShovel(2, 30, '#e6e6e6', 2);
  drawShovel(3, 30, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), 3);
  drawShovel(4, 30, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), 4);

  drawAxe(2, 31, (ITEM_COLORS[BLOCK.WOODEN_PICKAXE] || '#8b5a2b'), 0);
  drawAxe(3, 31, '#9a9a9a', 1);
  drawAxe(4, 31, '#e6e6e6', 2);
  drawAxe(5, 31, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), 3);
  drawAxe(6, 31, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), 4);

  drawFood(7, 31, (ITEM_COLORS[BLOCK.APPLE] || '#ff4d4d'), true); // Apple
  drawFood(8, 31, (ITEM_COLORS[BLOCK.SKYCOIN] || '#ffd700'), true); // Golden Apple
  drawFood(9, 31, (ITEM_COLORS[BLOCK.COOKED_BEEF] || '#6b3e26'), false); // Steak
  drawFood(10, 31, (ITEM_COLORS[BLOCK.RAW_BEEF] || '#ff7070'), false); // Raw Beef

  const drawRod = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
    for(let i=0; i<14; i++) ctx.fillRect(x*size + i, y*size + 15 - i, 2, 2);
    ctx.strokeStyle = '#aaaaaa';
    ctx.beginPath(); ctx.moveTo(x*size+13, y*size+2); ctx.lineTo(x*size+13, y*size+14); ctx.stroke();
  };

  const drawBow = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.strokeStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29');
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x*size + 4, y*size + 8, 6, -Math.PI/2, Math.PI/2); ctx.stroke();
    ctx.strokeStyle = '#eeeeee';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x*size+4, y*size+2); ctx.lineTo(x*size+4, y*size+14); ctx.stroke();
  };

  const drawArrow = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.ARROW] || '#dddddd');
    for(let i=0; i<12; i++) ctx.fillRect(x*size + i, y*size + 15 - i, 1, 1);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.WOOD] || '#6b4d29'); // Shaft
    ctx.fillStyle = '#444444'; // Tip
    ctx.fillRect(x*size + 11, y*size + 3, 2, 2);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'); // Feather
    ctx.fillRect(x*size + 1, y*size + 13, 2, 2);
  };

  drawRod(11, 31);
  drawBow(12, 31);
  drawArrow(13, 31);

  const drawBucket = (x: number, y: number, liquidColor?: string) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.BUCKET] || '#cccccc');
    ctx.fillRect(x*size + 5, y*size + 5, 6, 8);
    ctx.fillRect(x*size + 4, y*size + 4, 8, 2);
    ctx.fillStyle = '#AAAAAA';
    ctx.fillRect(x*size + 5, y*size + 12, 6, 1);
    
    if(liquidColor) {
      ctx.fillStyle = liquidColor;
      ctx.fillRect(x*size + 5, y*size + 6, 6, 4);
    }
  };

  drawBucket(14, 31);
  drawBucket(15, 31, (ITEM_COLORS[BLOCK.WATER] || '#3f76e4')); // Water
  drawBucket(16, 31, (ITEM_COLORS[BLOCK.CONCRETE_ORANGE] || '#f07613')); // Lava

  const drawLump = (x: number, y: number, color: string, high: string, dark: string) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = '#111111';
    ctx.fillRect(x * size + 4, y * size + 4, 8, 8);
    ctx.fillRect(x * size + 5, y * size + 3, 6, 10);
    ctx.fillRect(x * size + 3, y * size + 5, 10, 6);
    
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 5, y * size + 4, 6, 8);
    ctx.fillRect(x * size + 4, y * size + 5, 8, 6);
    
    ctx.fillStyle = high;
    ctx.fillRect(x * size + 5, y * size + 4, 2, 2);
    ctx.fillRect(x * size + 4, y * size + 6, 1, 1);

    ctx.fillStyle = dark;
    ctx.fillRect(x * size + 9, y * size + 8, 2, 2);
    ctx.fillRect(x * size + 11, y * size + 7, 1, 1);
  };

  const drawPearl = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = '#111111';
    ctx.beginPath(); ctx.arc(x*size + 8, y*size + 8, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = (ITEM_COLORS[BLOCK.ENDER_PEARL] || '#0b4c42');
    ctx.beginPath(); ctx.arc(x*size + 8, y*size + 8, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#177b6d';
    ctx.fillRect(x*size + 6, y*size + 6, 2, 2);
  };

  const drawBone = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.BONE] || '#ebebeb');
    for(let i=0; i<12; i++) ctx.fillRect(x*size + i + 2, y*size + 13 - i, 2, 2);
    ctx.fillRect(x*size + 2, y*size + 12, 3, 3);
    ctx.fillRect(x*size + 11, y*size + 3, 3, 3);
  };

  const drawFeather = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
    for(let i=0; i<12; i++) {
        ctx.fillRect(x*size + i + 2, y*size + 13 - i, 1, 1);
        ctx.fillRect(x*size + i + 1, y*size + 13 - i, 2, 2);
    }
  };

  drawPearl(17, 31);
  drawBone(18, 31);
  drawLump(19, 31, (ITEM_COLORS[BLOCK.GUNPOWDER] || '#545454'), '#777777', '#333333'); // Gunpowder
  drawLump(20, 31, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), (ITEM_COLORS[BLOCK.ARROW] || '#dddddd')); // String (bundle)
  drawFeather(21, 31);

  const drawBread = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.BREAD] || '#d19e59');
    ctx.fillRect(x*size + 3, y*size + 6, 10, 6);
    ctx.fillRect(x*size + 4, y*size + 5, 8, 8);
    ctx.fillStyle = '#b07f40';
    ctx.fillRect(x*size + 5, y*size + 7, 2, 1);
    ctx.fillRect(x*size + 8, y*size + 7, 2, 1);
    ctx.fillRect(x*size + 11, y*size + 7, 1, 1);
  };

  const drawSeeds = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = (ITEM_COLORS[BLOCK.SEEDS] || '#4a5d23');
    ctx.fillRect(x*size + 6, y*size + 6, 1, 1);
    ctx.fillRect(x*size + 9, y*size + 8, 1, 1);
    ctx.fillRect(x*size + 7, y*size + 10, 1, 1);
    ctx.fillStyle = '#6b8a32';
    ctx.fillRect(x*size + 8, y*size + 6, 1, 1);
    ctx.fillRect(x*size + 6, y*size + 9, 1, 1);
  };

  drawBread(22, 31);
  drawSeeds(23, 31);

  // --- INGOTS & GEMS ---
  const drawIngot = (x: number, y: number, baseMap: string, highlightMap: string, shadowMap: string) => {
    ctx.clearRect(x * size, y * size, size, size);
    
    // Outline
    ctx.fillStyle = '#111111';
    ctx.fillRect(x*size + 2, y*size + 6, 12, 6);
    ctx.fillRect(x*size + 3, y*size + 4, 10, 8);

    // Body
    ctx.fillStyle = baseMap;
    ctx.fillRect(x*size + 3, y*size + 5, 10, 6);
    
    // Shading
    ctx.fillStyle = shadowMap;
    ctx.fillRect(x*size + 3, y*size + 10, 10, 1);
    ctx.fillRect(x*size + 12, y*size + 6, 1, 5);
    
    // Highlight
    ctx.fillStyle = highlightMap;
    ctx.fillRect(x*size + 3, y*size + 5, 9, 1);
    ctx.fillRect(x*size + 3, y*size + 5, 1, 4);
    
    // Extra shine
    ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
    ctx.fillRect(x*size + 4, y*size + 6, 1, 1);
  };
  
  const drawGem = (x: number, y: number, baseC: string, highC: string, shadowC: string) => {
    ctx.clearRect(x * size, y * size, size, size);
    
    // Outline
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.moveTo(x*size + 8, y*size + 2);
    ctx.lineTo(x*size + 13, y*size + 7);
    ctx.lineTo(x*size + 8, y*size + 14);
    ctx.lineTo(x*size + 3, y*size + 7);
    ctx.closePath();
    ctx.fill();
    
    // Inner
    ctx.fillStyle = baseC;
    ctx.fillRect(x*size + 5, y*size + 4, 6, 8);
    ctx.fillRect(x*size + 4, y*size + 6, 8, 4);
    
    // Facets
    ctx.fillStyle = highC;
    ctx.fillRect(x*size + 5, y*size + 4, 3, 3);
    ctx.fillStyle = shadowC;
    ctx.fillRect(x*size + 8, y*size + 9, 3, 3);
    
    ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
    ctx.fillRect(x*size + 6, y*size + 5, 1, 1);
  };

  const drawCoin = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    
    // Outer rim
    ctx.fillStyle = '#1a1a00';
    ctx.beginPath(); ctx.arc(x*size + 8, y*size + 8, 6.5, 0, Math.PI*2); ctx.fill();
    
    // Gold base
    const grad = ctx.createRadialGradient(x*size + 6, y*size + 6, 1, x*size + 8, y*size + 8, 6);
    grad.addColorStop(0, '#fff5b1');
    grad.addColorStop(0.5, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'));
    grad.addColorStop(1, '#bfa51c');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x*size + 8, y*size + 8, 5.5, 0, Math.PI*2); ctx.fill();
    
    // Inner detail (S)
    ctx.fillStyle = '#bfa51c';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('$', x*size + 8, y*size + 11);
  };

  drawIngot(5, 28, '#e6e6e6', (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#aaaaaa'); // Iron
  drawIngot(6, 28, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), '#fff5b1', '#bfa51c'); // Gold
  drawGem(7, 28, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), (ITEM_COLORS[BLOCK.DIAMOND_PICKAXE] || '#b9f2ff'), '#14897f'); // Diamond
  drawCoin(8, 28); // Skycoin
  drawLump(9, 28, '#333333', '#555555', '#111111'); // Coal
  drawGem(10, 28, (ITEM_COLORS[BLOCK.EMERALD_ORE] || '#17dd62'), '#5fff9d', '#0d8a3d'); // Emerald
  drawLump(11, 28, (ITEM_COLORS[BLOCK.FLOWER_RED] || '#ff0000'), '#ff5555', '#aa0000'); // Redstone
  drawLump(12, 28, (ITEM_COLORS[BLOCK.LAPIS_ORE] || '#1034bd'), '#4466ee', '#081a5e'); // Lapis
  drawIngot(13, 28, (ITEM_COLORS[BLOCK.COPPER_INGOT] || '#e39452'), '#f6b889', '#b36a2d'); // Copper Ingot

  drawTile(0, 9, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#E4E4E4');
  drawTile(1, 9, (ITEM_COLORS[BLOCK.CONCRETE_ORANGE] || '#f07613'), '#E06704');
  drawTile(2, 9, (ITEM_COLORS[BLOCK.CONCRETE_MAGENTA] || '#bd44b3'), '#A4349A');
  drawTile(3, 9, (ITEM_COLORS[BLOCK.CONCRETE_LIGHT_BLUE] || '#3aafd9'), '#2798C1');
  drawTile(4, 9, (ITEM_COLORS[BLOCK.CONCRETE_YELLOW] || '#f8c627'), '#E8B415');
  drawTile(5, 9, (ITEM_COLORS[BLOCK.CONCRETE_LIME] || '#70b919'), '#5EA111');
  drawTile(6, 9, (ITEM_COLORS[BLOCK.CONCRETE_PINK] || '#ed8dac'), '#D97796');
  drawTile(7, 9, (ITEM_COLORS[BLOCK.CONCRETE_GRAY] || '#3e4447'), '#2E3436');
  drawTile(8, 9, (ITEM_COLORS[BLOCK.CONCRETE_LIGHT_GRAY] || '#8e8e86'), '#7A7A71');
  drawTile(9, 9, (ITEM_COLORS[BLOCK.CONCRETE_CYAN] || '#158991'), '#117178');
  drawTile(10, 9, (ITEM_COLORS[BLOCK.CONCRETE_PURPLE] || '#792aac'), '#641C8F');
  drawTile(11, 9, (ITEM_COLORS[BLOCK.CONCRETE_BLUE] || '#35399d'), '#2B2E8A');
  drawTile(12, 9, (ITEM_COLORS[BLOCK.CONCRETE_BROWN] || '#724728'), '#59361C');
  drawTile(13, 9, (ITEM_COLORS[BLOCK.CONCRETE_GREEN] || '#546d1b'), '#425712');
  drawTile(14, 9, (ITEM_COLORS[BLOCK.CONCRETE_RED] || '#a12722'), '#8E201B');
  drawTile(15, 9, (ITEM_COLORS[BLOCK.CONCRETE_BLACK] || '#141519'), '#0D0E11');

  ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
  ctx.fillRect(0 * size, 10 * size, size, size);
  ctx.fillStyle = '#E4E4E4';
  for(let i=0; i<20; i++) {
     const nx = 0 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_ORANGE] || '#f07613');
  ctx.fillRect(1 * size, 10 * size, size, size);
  ctx.fillStyle = '#E06704';
  for(let i=0; i<20; i++) {
     const nx = 1 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_MAGENTA] || '#bd44b3');
  ctx.fillRect(2 * size, 10 * size, size, size);
  ctx.fillStyle = '#A4349A';
  for(let i=0; i<20; i++) {
     const nx = 2 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_LIGHT_BLUE] || '#3aafd9');
  ctx.fillRect(3 * size, 10 * size, size, size);
  ctx.fillStyle = '#2798C1';
  for(let i=0; i<20; i++) {
     const nx = 3 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_YELLOW] || '#f8c627');
  ctx.fillRect(4 * size, 10 * size, size, size);
  ctx.fillStyle = '#E8B415';
  for(let i=0; i<20; i++) {
     const nx = 4 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_LIME] || '#70b919');
  ctx.fillRect(5 * size, 10 * size, size, size);
  ctx.fillStyle = '#5EA111';
  for(let i=0; i<20; i++) {
     const nx = 5 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_PINK] || '#ed8dac');
  ctx.fillRect(6 * size, 10 * size, size, size);
  ctx.fillStyle = '#D97796';
  for(let i=0; i<20; i++) {
     const nx = 6 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_GRAY] || '#3e4447');
  ctx.fillRect(7 * size, 10 * size, size, size);
  ctx.fillStyle = '#2E3436';
  for(let i=0; i<20; i++) {
     const nx = 7 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_LIGHT_GRAY] || '#8e8e86');
  ctx.fillRect(8 * size, 10 * size, size, size);
  ctx.fillStyle = '#7A7A71';
  for(let i=0; i<20; i++) {
     const nx = 8 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_CYAN] || '#158991');
  ctx.fillRect(9 * size, 10 * size, size, size);
  ctx.fillStyle = '#117178';
  for(let i=0; i<20; i++) {
     const nx = 9 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_PURPLE] || '#792aac');
  ctx.fillRect(10 * size, 10 * size, size, size);
  ctx.fillStyle = '#641C8F';
  for(let i=0; i<20; i++) {
     const nx = 10 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_BLUE] || '#35399d');
  ctx.fillRect(11 * size, 10 * size, size, size);
  ctx.fillStyle = '#2B2E8A';
  for(let i=0; i<20; i++) {
     const nx = 11 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_BROWN] || '#724728');
  ctx.fillRect(12 * size, 10 * size, size, size);
  ctx.fillStyle = '#59361C';
  for(let i=0; i<20; i++) {
     const nx = 12 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_GREEN] || '#546d1b');
  ctx.fillRect(13 * size, 10 * size, size, size);
  ctx.fillStyle = '#425712';
  for(let i=0; i<20; i++) {
     const nx = 13 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_RED] || '#a12722');
  ctx.fillRect(14 * size, 10 * size, size, size);
  ctx.fillStyle = '#8E201B';
  for(let i=0; i<20; i++) {
     const nx = 14 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  ctx.fillStyle = (ITEM_COLORS[BLOCK.CONCRETE_BLACK] || '#141519');
  ctx.fillRect(15 * size, 10 * size, size, size);
  ctx.fillStyle = '#0D0E11';
  for(let i=0; i<20; i++) {
     const nx = 15 * size + Math.random() * size;
     const ny = 10 * size + Math.random() * size;
     ctx.fillRect(nx, ny, 2, 2);
  }

  // --- GLASS COLORS (Row 11) ---
  const glassColors = [
    { name: 'GLASS_WHITE', color: '#FFFFFF' },
    { name: 'GLASS_ORANGE', color: '#F07613' },
    { name: 'GLASS_MAGENTA', color: '#BD44B3' },
    { name: 'GLASS_LIGHT_BLUE', color: '#3AAfd9' },
    { name: 'GLASS_YELLOW', color: '#F8C627' },
    { name: 'GLASS_LIME', color: '#70B919' },
    { name: 'GLASS_PINK', color: '#ED8DAC' },
    { name: 'GLASS_GRAY', color: '#3E4447' },
    { name: 'GLASS_LIGHT_GRAY', color: '#8E8E86' },
    { name: 'GLASS_CYAN', color: '#158991' },
    { name: 'GLASS_PURPLE', color: '#792AAC' },
    { name: 'GLASS_BLUE', color: '#35399D' },
    { name: 'GLASS_BROWN', color: '#724728' },
    { name: 'GLASS_GREEN', color: '#546D1B' },
    { name: 'GLASS_RED', color: '#A12722' },
    { name: 'GLASS_BLACK', color: '#141519' }
  ];

  glassColors.forEach((gc, i) => {
    ctx.clearRect(i * size, 11 * size, size, size);
    // Base transparent color
    ctx.fillStyle = gc.color + '44'; 
    ctx.fillRect(i * size, 11 * size, size, size);
    
    // Border
    ctx.strokeStyle = gc.color + '88';
    ctx.lineWidth = 1;
    ctx.strokeRect(i * size + 0.5, 11 * size + 0.5, size - 1, size - 1);
    
    // Glass glints
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(i * size + 4, 11 * size + 4); ctx.lineTo(i * size + 6, 11 * size + 6);
    ctx.moveTo(i * size + 10, 11 * size + 10); ctx.lineTo(i * size + 12, 11 * size + 12);
    ctx.stroke();
  });


  // --- AUTOMATIC PROCEDURAL TILE GENERATION FOR MISSING TILES ---
  for (const [key, value] of Object.entries(BLOCK)) {
     if (typeof value === 'number' && value > 0) {
        const uvs = BLOCK_UVS[value];
        if (uvs && uvs[0]) {
           const u = uvs[0][0];
           const v = uvs[0][1];
           // Only procedural generate for rows 12-26, and rows 4-8. Row 27-31 are manual high-res icons.
           if ((v >= 12 && v <= 26) || (v >= 4 && v <= 8)) {
              const color = ITEM_COLORS[value] || '#999999';
              // Darken color slightly for noise
              ctx.fillStyle = color;
              ctx.fillRect(u * size, v * size, size, size);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
              for (let i = 0; i < 30; i++) {
                 const nx = u * size + Math.random() * size;
                 const ny = v * size + Math.random() * size;
                 ctx.fillRect(nx, ny, 1, 1);
              }
              // Lighten top edge for a slightly blocky texture feel
              ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.fillRect(u * size, v * size, size, 2);
              // Darken bottom edge
              ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
              ctx.fillRect(u * size, v * size + size - 2, size, 2);
           }
        }
     }
  }

  // --- Torch (12, 27) ---
  ctx.clearRect(12 * size, 27 * size, size, size);
  // Stick with shading
  ctx.fillStyle = '#5A3A22'; // Shadow
  ctx.fillRect(12 * size + 6, 27 * size + 6, 4, 10);
  ctx.fillStyle = '#8B4513'; // Highlight
  ctx.fillRect(12 * size + 6, 27 * size + 6, 2, 10);
  
  // Flame base (Deep orange)
  ctx.fillStyle = '#E64A19'; 
  ctx.fillRect(12 * size + 5, 27 * size + 3, 6, 4);
  
  // Flame center (Orange/Yellow)
  ctx.fillStyle = '#FF9800'; 
  ctx.fillRect(12 * size + 6, 27 * size + 1, 4, 3);
  
  // Flame core (White/Yellow)
  ctx.fillStyle = '#FFFF8D'; 
  ctx.fillRect(12 * size + 7, 27 * size + 0, 2, 2);
  
  // Sparks
  ctx.fillStyle = '#FFAB91';
  ctx.fillRect(12 * size + 4, 27 * size + 4, 1, 1);
  ctx.fillRect(12 * size + 11, 27 * size + 2, 1, 1);
  ctx.fillRect(12 * size + 8, 27 * size - 1, 1, 1);
  
  
  // --- ASPECT OF THE END (24, 31) ---
  const drawAOTE = (x: number, y: number) => {
    drawTool(x, y, false, (ITEM_COLORS[BLOCK.ASPECT_OF_THE_END] || '#55ffff'), 4); // Cyan sword
  };

  // --- MINION (25, 31) ---
  const drawMinion = (x: number, y: number) => {
    ctx.clearRect(x * size, y * size, size, size);
    ctx.fillStyle = '#FFFF55';
    ctx.fillRect(x*size + 4, y*size + 4, 8, 8); // Head
    ctx.fillStyle = '#111111';
    ctx.fillRect(x*size + 5, y*size + 6, 2, 2); // Eye
    ctx.fillRect(x*size + 9, y*size + 6, 2, 2); // Eye
    ctx.fillStyle = '#FF5555';
    ctx.fillRect(x*size + 6, y*size + 10, 4, 1); // Mouth
  };

  drawAOTE(24, 31);
  drawMinion(25, 31);

  // --- Glowstone Redesign (8, 27) ---
  ctx.clearRect(8 * size, 27 * size, size, size);
  ctx.fillStyle = '#b57912'; // Base dark gold/brown
  ctx.fillRect(8 * size, 27 * size, size, size);
  
  // Crystals
  ctx.fillStyle = '#ffce3b';
  ctx.fillRect(8 * size + 2, 27 * size + 2, 6, 5);
  ctx.fillRect(8 * size + 1, 27 * size + 9, 5, 5);
  ctx.fillRect(8 * size + 9, 27 * size + 1, 5, 6);
  ctx.fillRect(8 * size + 8, 27 * size + 9, 6, 6);
  
  // Bright highlights
  ctx.fillStyle = '#ffea8c';
  ctx.fillRect(8 * size + 3, 27 * size + 3, 3, 2);
  ctx.fillRect(8 * size + 2, 27 * size + 10, 2, 2);
  ctx.fillRect(8 * size + 10, 27 * size + 2, 2, 3);
  ctx.fillRect(8 * size + 9, 27 * size + 10, 3, 3);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
  ctx.fillRect(8 * size + 4, 27 * size + 4, 1, 1);
  ctx.fillRect(8 * size + 10, 27 * size + 11, 1, 1);
  ctx.fillRect(8 * size + 11, 27 * size + 3, 1, 1);

  // --- Sugar Cane (9, 27) ---
  ctx.clearRect(9 * size, 27 * size, size, size);
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SUGAR_CANE] || '#68b936');
  ctx.fillRect(9 * size + 4, 27 * size + 2, 2, 12);
  ctx.fillRect(9 * size + 7, 27 * size + 4, 2, 10);
  ctx.fillRect(9 * size + 10, 27 * size + 1, 2, 13);
  ctx.fillStyle = '#4A8522'; // segments
  for(let i=0; i<3; i++) {
    ctx.fillRect(9 * size + 4 + i*3, 27 * size + 5, 2, 1);
    ctx.fillRect(9 * size + 4 + i*3, 27 * size + 9, 2, 1);
  }

  // Horns on face texture
  ctx.fillStyle = (ITEM_COLORS[BLOCK.ARROW] || '#dddddd');
  ctx.fillRect(3 * size + 1, 4 * size + 1, 2, 3);
  ctx.fillRect(3 * size + 13, 4 * size + 1, 2, 3);

  // 3,5: Cow Body
  drawTile(3, 5, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#eeeeee'); // White base
  ctx.fillStyle = '#222222'; // Black spots
  // More organic spots
  ctx.fillRect(3 * size + 1, 5 * size + 2, 5, 4);
  ctx.fillRect(3 * size + 9, 5 * size + 1, 6, 5);
  ctx.fillRect(3 * size + 2, 5 * size + 9, 4, 6);
  ctx.fillRect(3 * size + 10, 5 * size + 10, 5, 4);
  ctx.fillRect(3 * size + 6, 5 * size + 6, 3, 3);

  // 4,4: Cow Leg
  drawTile(4, 4, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#eeeeee'); // White leg
  ctx.fillStyle = '#111111'; // Black hoof
  ctx.fillRect(4 * size, 4 * size + 12, size, 4);
  ctx.fillStyle = '#222222'; // Some spots on legs
  ctx.fillRect(4 * size + 2, 4 * size + 2, 4, 4);

  // 4,5: Sheep Leg
  drawTile(4, 5, '#e3c5a8', '#d1b08c');
  ctx.fillStyle = '#c4a484'; // Slight shading at bottom
  ctx.fillRect(4 * size, 5 * size + 12, size, 4);

  // 1,6: Skeleton Leg/Arm (Bone)
  drawTile(1, 6, (ITEM_COLORS[BLOCK.ARROW] || '#dddddd'), '#bbbbbb');
  ctx.fillStyle = (ITEM_COLORS[BLOCK.BUCKET] || '#cccccc');
  for(let i=0; i<4; i++) ctx.fillRect(1 * size + Math.random()*14, 6 * size + Math.random()*14, 2, 2);

  // 5,4: Sheep Face
  drawTile(5, 4, '#e3c5a8', '#d1b08c'); // Warmer skin tone
  ctx.fillStyle = '#000000';
  ctx.fillRect(5 * size + 2, 4 * size + 6, 3, 2);
  ctx.fillRect(5 * size + 11, 4 * size + 6, 3, 2);
  ctx.fillStyle = '#ffaaaa';
  ctx.fillRect(5 * size + 6, 4 * size + 11, 4, 3);

  // 5,5: Sheep Body (Wool)
  drawTile(5, 5, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#f0f0f0');
  ctx.fillStyle = '#e0e0e0';
  // More "fluffy" wool texture
  for(let i=0; i<24; i++) {
    ctx.fillRect(5 * size + Math.random()*13, 5 * size + Math.random()*13, 3, 3);
  }
  ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
  for(let i=0; i<12; i++) {
    ctx.fillRect(5 * size + Math.random()*14, 5 * size + Math.random()*14, 2, 2);
  }

  // 6,4: Slime Face
  ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
  ctx.fillRect(6 * size, 4 * size, size, size);
  ctx.fillStyle = '#004400';
  ctx.fillRect(6 * size + 3, 4 * size + 4, 3, 3);
  ctx.fillRect(6 * size + 10, 4 * size + 4, 3, 3);
  ctx.fillRect(6 * size + 6, 4 * size + 10, 4, 2);

  // 6,5: Slime Body
  ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
  ctx.fillRect(6 * size, 5 * size, size, size);
  ctx.fillStyle = 'rgba(0, 200, 0, 0.5)';
  for(let i=0; i<10; i++) ctx.fillRect(6 * size + Math.random()*14, 5 * size + Math.random()*14, 2, 2);

  // 0,26: Chest Front (With Latch)
  drawTile(0, 26, '#8f6b42', '#5a422a'); // Rich warm wood
  // Metal bands
  ctx.fillStyle = '#3d3d3d'; // Dark steel bands
  ctx.fillRect(0 * size, 26 * size + 1, size, 2); // Top band
  ctx.fillRect(0 * size, 26 * size + 13, size, 2); // Bottom band
  ctx.fillRect(0 * size + 1, 26 * size, 2, size); // Left band
  ctx.fillRect(0 * size + 13, 26 * size, 2, size); // Right band
  // Golden rivets
  ctx.fillStyle = '#d4af37'; 
  ctx.fillRect(0 * size + 1, 26 * size + 1, 1, 1);
  ctx.fillRect(0 * size + 14, 26 * size + 1, 1, 1);
  ctx.fillRect(0 * size + 1, 26 * size + 14, 1, 1);
  ctx.fillRect(0 * size + 14, 26 * size + 14, 1, 1);
  // High-poly look Latch (Only on front)
  ctx.fillStyle = '#bfbfbf'; // Silver latch base
  ctx.fillRect(0 * size + 6, 26 * size + 6, 4, 4);
  ctx.fillStyle = '#1a1a1a'; // Keyhole
  ctx.fillRect(0 * size + 7.5, 26 * size + 7.5, 1, 2);

  // 1,26: Chest Top
  drawTile(1, 26, '#8f6b42', '#563e27');
  ctx.fillStyle = '#3d3d3d';
  ctx.fillRect(1 * size + 1, 26 * size + 1, size - 2, 2);
  ctx.fillRect(1 * size + 1, 26 * size + 13, size - 2, 2);
  ctx.fillRect(1 * size + 1, 26 * size + 1, 2, size - 2);
  ctx.fillRect(1 * size + 13, 26 * size + 1, 2, size - 2);
  // rivets
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(1 * size + 1, 26 * size + 1, 1, 1);
  ctx.fillRect(1 * size + 14, 26 * size + 1, 1, 1);
  ctx.fillRect(1 * size + 1, 26 * size + 14, 1, 1);
  ctx.fillRect(1 * size + 14, 26 * size + 14, 1, 1);

  // 2,26: Chest Side/Back (No Latch)
  drawTile(2, 26, '#8f6b42', '#5a422a');
  ctx.fillStyle = '#3d3d3d';
  ctx.fillRect(2 * size, 26 * size + 1, size, 2);
  ctx.fillRect(2 * size, 26 * size + 13, size, 2);
  ctx.fillRect(2 * size + 1, 26 * size, 2, size);
  ctx.fillRect(2 * size + 13, 26 * size, 2, size);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(2 * size + 1, 26 * size + 1, 1, 1);
  ctx.fillRect(2 * size + 14, 26 * size + 1, 1, 1);
  ctx.fillRect(2 * size + 1, 26 * size + 14, 1, 1);
  ctx.fillRect(2 * size + 14, 26 * size + 14, 1, 1);

  // --- ORES ---
  const drawOreExt = (x: number, y: number, color: string, isDeepslate: boolean, orePattern: number) => {
    // Base tile
    const c1 = isDeepslate ? '#313133' : (ITEM_COLORS[BLOCK.FURNACE] || '#7d7d7d');
    const c2 = isDeepslate ? '#212122' : '#6b6b6b';
    drawTile(x, y, c1, c2); 
    
    // Smooth the base a bit with subtle highlights/shadows
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x*size, y*size, size, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(x*size, y*size + size - 2, size, 2);

    // Ore flecks based on pattern
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const rgbToHex = (r: number, g: number, b: number) => `#${((1 << 24) + (Math.max(0, Math.min(255, r)) << 16) + (Math.max(0, Math.min(255, g)) << 8) + Math.max(0, Math.min(255, b))).toString(16).slice(1)}`;
    
    const base = hexToRgb(color);
    const bright = rgbToHex(base.r + 60, base.g + 60, base.b + 60);
    const dark = rgbToHex(base.r - 60, base.g - 60, base.b - 60);

    let flecks: number[][] = [];
    if (orePattern === 0) { // Blobs (Coal/Nether Gold)
       flecks = [[3, 3, 4, 3], [10, 4, 3, 3], [4, 10, 3, 4], [9, 10, 4, 3], [7, 7, 2, 2]];
    } else if (orePattern === 1) { // Streaks (Iron, Gold, Copper)
       flecks = [[2, 2, 3, 2], [5, 4, 4, 2], [10, 9, 3, 2], [3, 11, 4, 2], [8, 12, 3, 2], [11, 4, 2, 3]];
    } else { // Crystals (Diamond, Emerald, Redstone, Lapis)
       flecks = [[4, 4, 3, 3], [11, 5, 2, 3], [5, 11, 3, 2], [10, 10, 4, 3], [7, 8, 2, 2], [2, 8, 3, 2], [12, 2, 2, 2]];
    }
    
    flecks.forEach(([fx, fy, fw, fh]) => {
      // Depth shadow on the stone behind the ore
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x*size + fx - 1, y*size + fy - 1, fw + 2, fh + 2);
      
      // Main ore color
      ctx.fillStyle = color;
      ctx.fillRect(x*size + fx, y*size + fy, fw, fh);
      
      // Highlights
      ctx.fillStyle = bright;
      ctx.fillRect(x*size + fx, y*size + fy, Math.max(1, fw/2), 1);
      ctx.fillRect(x*size + fx, y*size + fy, 1, Math.max(1, fh/2));
      
      // Lowlights
      ctx.fillStyle = dark;
      ctx.fillRect(x*size + fx + Math.floor(fw/2), y*size + fy + fh - 1, Math.ceil(fw/2), 1);
      ctx.fillRect(x*size + fx + fw - 1, y*size + fy + Math.floor(fh/2), 1, Math.ceil(fh/2));
      
      // Extra shine for crystals
      if (orePattern === 2) {
          ctx.fillStyle = (ITEM_COLORS[BLOCK.SNOW] || '#ffffff');
          ctx.fillRect(x*size + fx + 1, y*size + fy + 1, 1, 1);
      }
    });
  };

  // Stone Ores
  drawOreExt(0, 8, '#333333', false, 0); // Coal
  drawOreExt(1, 8, (ITEM_COLORS[BLOCK.IRON_ORE] || '#d8af93'), false, 1); // Iron
  drawOreExt(2, 8, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), false, 1); // Gold
  drawOreExt(3, 8, (ITEM_COLORS[BLOCK.LAPIS_ORE] || '#1034bd'), false, 2); // Lapis
  drawOreExt(4, 8, (ITEM_COLORS[BLOCK.FLOWER_RED] || '#ff0000'), false, 2); // Redstone
  drawOreExt(5, 8, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), false, 2); // Diamond
  drawOreExt(6, 8, (ITEM_COLORS[BLOCK.EMERALD_ORE] || '#17dd62'), false, 2); // Emerald
  // Deepslate Ores
  drawOreExt(8, 25, '#222222', true, 0); // Coal
  drawOreExt(9, 25, (ITEM_COLORS[BLOCK.IRON_ORE] || '#d8af93'), true, 1); // Iron
  drawOreExt(10, 25, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), true, 1); // Gold
  drawOreExt(11, 25, (ITEM_COLORS[BLOCK.FLOWER_RED] || '#ff0000'), true, 2); // Redstone
  drawOreExt(12, 25, (ITEM_COLORS[BLOCK.EMERALD_ORE] || '#17dd62'), true, 2); // Emerald
  drawOreExt(13, 25, (ITEM_COLORS[BLOCK.LAPIS_ORE] || '#1034bd'), true, 2); // Lapis
  drawOreExt(14, 25, (ITEM_COLORS[BLOCK.DIAMOND_ORE] || '#2ee0d1'), true, 2); // Diamond
  // Copper
  drawOreExt(21, 21, (ITEM_COLORS[BLOCK.COPPER_INGOT] || '#e39452'), false, 1); // Copper
  drawOreExt(22, 21, (ITEM_COLORS[BLOCK.COPPER_INGOT] || '#e39452'), true, 1); // Deepslate Copper
  // Nether
  drawOreExt(10, 18, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), false, 2); // Nether Quartz
  drawOreExt(15, 25, (ITEM_COLORS[BLOCK.GOLD_ORE] || '#fcee4b'), false, 1); // Nether Gold

  // --- MOB SKIN TILES ---
  // 0,22: Zombie Face
  drawTile(0, 22, '#2e4d23', '#253f1c'); // Deep greenish-black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0 * size + 2, 22 * size + 6, 4, 3); // Left eye
  ctx.fillRect(0 * size + 10, 22 * size + 6, 4, 3); // Right eye
  ctx.fillStyle = '#1a2b14';
  ctx.fillRect(0 * size + 7, 22 * size + 9, 2, 2);

  // 1,22: Skeleton Face
  drawTile(1, 22, (ITEM_COLORS[BLOCK.ARROW] || '#dddddd'), '#bbbbbb');
  ctx.fillStyle = '#222222';
  ctx.fillRect(1 * size + 3, 22 * size + 5, 4, 4); 
  ctx.fillRect(1 * size + 9, 22 * size + 5, 4, 4);
  ctx.fillRect(1 * size + 7, 22 * size + 9, 2, 2);

  // 2,22: Creeper Face
  drawTile(2, 22, '#0da82e', '#0a8a25'); 
  ctx.fillStyle = '#000000';
  ctx.fillRect(2 * size + 3, 22 * size + 4, 3, 3);
  ctx.fillRect(2 * size + 10, 22 * size + 4, 3, 3);
  ctx.fillRect(2 * size + 6, 22 * size + 7, 4, 5); 
  ctx.fillRect(2 * size + 4, 22 * size + 10, 8, 3);

  // 3,22: Zombie Body/Limbs (Noise)
  drawTile(3, 22, '#2e4d23', '#253f1c');
  ctx.fillStyle = '#3a5f2c';
  for(let i=0; i<6; i++) ctx.fillRect(3 * size + Math.random()*13, 22 * size + Math.random()*13, 3, 3);

  // 4,22: Skeleton Limbs (Bony Texture)
  drawTile(4, 22, '#eeeeee', (ITEM_COLORS[BLOCK.ARROW] || '#dddddd')); // Brighter bone
  ctx.fillStyle = (ITEM_COLORS[BLOCK.BUCKET] || '#cccccc'); // Shadow noise
  for(let i=0; i<12; i++) ctx.fillRect(4 * size + Math.random()*13, 22 * size + Math.random()*13, 2, 2);
  // Joint shading at top/bottom
  ctx.fillStyle = '#bbbbbb';
  ctx.fillRect(4 * size, 22 * size, size, 1);
  ctx.fillRect(4 * size, 22 * size + 15, size, 1);

  // 5,22: Creeper Body (Noise)
  drawTile(5, 22, '#0da82e', '#0a8a25');
  ctx.fillStyle = '#11cc33';
  for(let i=0; i<8; i++) ctx.fillRect(5 * size + Math.random()*12, 22 * size + Math.random()*12, 4, 4);

  // 6,22: Cow Body (White with Black Spots)
  drawTile(6, 22, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#eeeeee'); 
  ctx.fillStyle = '#222222';
  ctx.fillRect(6 * size + 1, 22 * size + 2, 5, 4);
  ctx.fillRect(6 * size + 9, 22 * size + 1, 6, 5);
  ctx.fillRect(6 * size + 2, 22 * size + 9, 4, 6);
  ctx.fillRect(6 * size + 10, 22 * size + 10, 5, 4);

  // 7,22: Cow Face (Cute UwU Edition)
  drawTile(7, 22, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#eeeeee');
  ctx.fillStyle = '#222222'; 
  // Cute eyes (n n)
  ctx.fillStyle = '#222222';
  // Left eye
  ctx.fillRect(7 * size + 3, 22 * size + 5, 4, 1); // Top line
  ctx.fillRect(7 * size + 3, 22 * size + 6, 1, 2); // Left line
  ctx.fillRect(7 * size + 6, 22 * size + 6, 1, 2); // Right line

  // Right eye
  ctx.fillRect(7 * size + 9, 22 * size + 5, 4, 1); // Top line
  ctx.fillRect(7 * size + 9, 22 * size + 6, 1, 2); // Left line
  ctx.fillRect(7 * size + 12, 22 * size + 6, 1, 2); // Right line
  
  // Blush
  ctx.fillStyle = '#ffb6c1';
  ctx.fillRect(7 * size + 2, 22 * size + 8, 2, 1);
  ctx.fillRect(7 * size + 12, 22 * size + 8, 2, 1);

  ctx.fillStyle = '#ffaaaa'; // Snout
  ctx.fillRect(7 * size + 5, 22 * size + 10, 6, 4);

  // 8,22: Sheep Body (Wool)
  drawTile(8, 22, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#f0f0f0');
  ctx.fillStyle = '#e0e0e0';
  for(let i=0; i<24; i++) {
    ctx.fillRect(8 * size + Math.random()*13, 22 * size + Math.random()*13, 3, 3);
  }

  // 9,22: Sheep Face
  drawTile(9, 22, '#e3c5a8', '#d1b08c');
  ctx.fillStyle = '#000000';
  ctx.fillRect(9 * size + 2, 22 * size + 6, 3, 2);
  ctx.fillRect(9 * size + 11, 22 * size + 6, 3, 2);
  ctx.fillStyle = '#ffaaaa';
  ctx.fillRect(9 * size + 6, 22 * size + 11, 4, 3);

  // 10,22: Cow Leg
  drawTile(10, 22, (ITEM_COLORS[BLOCK.SNOW] || '#ffffff'), '#eeeeee');
  ctx.fillStyle = '#111111';
  ctx.fillRect(10 * size, 22 * size + 12, size, 4);

  // 11,22: Sheep Leg
  drawTile(11, 22, '#e3c5a8', '#d1b08c');
  ctx.fillStyle = '#c4a484';
  ctx.fillRect(11 * size, 22 * size + 12, size, 4);

  // 12,22: Zombie Shirt
  drawTile(12, 22, '#00aaaa', '#009090'); // Teal shirt
  // Neck hole
  ctx.fillStyle = '#2e4d23'; // Zombie green skin
  ctx.fillRect(12 * size + 5, 22 * size, 6, 2);
  // Pocket / detail
  ctx.fillStyle = '#008080';
  ctx.fillRect(12 * size + 3, 22 * size + 4, 3, 2);
  // Noise
  ctx.fillStyle = '#00bbbb';
  for(let i=0; i<8; i++) ctx.fillRect(12 * size + Math.random()*13, 22 * size + Math.random()*13, 2, 2);

  // 13,22: Zombie Pants
  drawTile(13, 22, '#2d2d88', '#252577'); // Blue pants
  // Belt / detail
  ctx.fillStyle = '#202060';
  ctx.fillRect(13 * size, 22 * size, size, 2);
  // Noise
  ctx.fillStyle = '#3a3aa9';
  for(let i=0; i<6; i++) ctx.fillRect(13 * size + Math.random()*13, 22 * size + Math.random()*13, 2, 2);

  // 15,24: Morvane Skin (Pitch Black)
  drawTile(15, 24, '#000000', '#050505');
  // 16,24: Morvane Face (Glowing Void)
  drawTile(16, 24, '#000000', '#050505');
  ctx.fillStyle = '#ff0000'; // Glowing red eyes
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#ff5555';
  ctx.fillRect(16 * size + 3, 24 * size + 5, 3, 2);
  ctx.fillRect(16 * size + 10, 24 * size + 5, 3, 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#220000'; // Scary mouth
  ctx.fillRect(16 * size + 4, 24 * size + 11, 8, 2);
  // 17,24: Morvane Plate (Unused now but for consistency)
  drawTile(17, 24, '#080808', '#000000');
  ctx.fillStyle = '#444444'; // Metal highlights
  for(let i=0; i<10; i++) ctx.fillRect(17 * size + Math.random()*14, 24 * size + Math.random()*14, 2, 2);

  // 0,25: Launcher Pad
  drawTile(0, 25, '#1e1e24', '#2a2a35'); // Dark metallic base
  
  // Outer border
  ctx.fillStyle = '#111111';
  ctx.fillRect(0 * size, 25 * size, size, 1);
  ctx.fillRect(0 * size, 25 * size + size - 1, size, 1);
  ctx.fillRect(0 * size, 25 * size, 1, size);
  ctx.fillRect(0 * size + size - 1, 25 * size, 1, size);
  
  // Inner metallic pad
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(0 * size + 2, 25 * size + 2, size - 4, size - 4);
  
  // Glowing center
  ctx.fillStyle = '#8a2be2'; // Purple glow
  ctx.shadowBlur = 5;
  ctx.shadowColor = '#9b59b6';
  ctx.fillRect(0 * size + 4, 25 * size + 4, 8, 8);
  
  // Up arrow in the center
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0 * size + 8, 25 * size + 4); // Peak
  ctx.lineTo(0 * size + 12, 25 * size + 8); // Right
  ctx.lineTo(0 * size + 9, 25 * size + 8);
  ctx.lineTo(0 * size + 9, 25 * size + 11); // Bottom right
  ctx.lineTo(0 * size + 7, 25 * size + 11); // Bottom left
  ctx.lineTo(0 * size + 7, 25 * size + 8); 
  ctx.lineTo(0 * size + 4, 25 * size + 8); // Left
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0; // Reset

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  cachedTexture = texture;
  return texture;
}

let cachedAtlasDataUrl: string | null = null;
export function getTextureAtlasDataUrl(): string {
  if (cachedAtlasDataUrl) return cachedAtlasDataUrl;
  
  const texture = createTextureAtlas();
  const canvas = texture.image as HTMLCanvasElement;
  cachedAtlasDataUrl = canvas.toDataURL();
  return cachedAtlasDataUrl;
}


export const getBlockUVs = (blockType: number) => {
  return BLOCK_UVS[blockType] || [[0,26], [0,26], [0,26], [0,26], [0,26], [0,26]]; // Fallback UV
};
