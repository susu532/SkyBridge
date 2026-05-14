import bakedBlocksData from '../../data/bakedBlocks.json';

export const bakedBlocksMap = new Map<string, number>(
  Object.entries(bakedBlocksData as Record<string, number>)
);