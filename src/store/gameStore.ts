import { create } from 'zustand';
import { ItemType, ItemStack } from '../game/Inventory';

interface GameState {
  inventoryVersion: number;
  incrementInventoryVersion: () => void;
  
  hotbarIndex: number;
  setHotbarIndex: (index: number) => void;

  inventoryIsOpen: boolean;
  setInventoryIsOpen: (isOpen: boolean) => void;
  
  skycoins: number;
  setSkycoins: (amount: number) => void;
  addSkycoins: (amount: number) => void;
  
  // Game Messages (toast notifications)
  messages: { id: number; text: string; color: string }[];
  addMessage: (text: string, color?: string) => void;
  removeMessage: (id: number) => void;
}

let messageIdCounter = 0;

export const useGameStore = create<GameState>((set) => ({
  inventoryVersion: 0,
  incrementInventoryVersion: () => set((state) => ({ inventoryVersion: state.inventoryVersion + 1 })),
  
  hotbarIndex: 0,
  setHotbarIndex: (index) => set({ hotbarIndex: index }),

  inventoryIsOpen: false,
  setInventoryIsOpen: (isOpen) => set({ inventoryIsOpen: isOpen }),

  skycoins: 500, // Starting Skycoins
  setSkycoins: (amount) => set({ skycoins: amount }),
  addSkycoins: (amount) => set((state) => ({ skycoins: state.skycoins + amount })),

  messages: [],
  addMessage: (text, color = '#FFFFFF') => {
    const id = messageIdCounter++;
    set((state) => ({
      messages: [...state.messages, { id, text, color }]
    }));
    // Auto-remove after 3 seconds
    setTimeout(() => {
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== id)
      }));
    }, 3000);
  },
  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter((m) => m.id !== id)
  })),
}));
