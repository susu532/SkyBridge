import dungeonBakedBlocksData from "../../data/dungeonBakedBlocks.json";

export const dungeonBakedBlocks = new Map<string, number>(
  Object.entries(dungeonBakedBlocksData)
);
