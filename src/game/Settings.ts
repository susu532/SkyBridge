
export interface GameSettings {
  renderDistance: number;
  fov: number;
  sensitivity: number;
  invertMouse: boolean;
  volume: number;
  showDebug: boolean;
  dayCycleSpeed: number;
  performanceMode: boolean;
  premiumShaders: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  renderDistance: 7,
  fov: 75,
  sensitivity: 0.002,
  invertMouse: false,
  volume: 0.5,
  showDebug: false,
  dayCycleSpeed: 0.0008,
  performanceMode: false,
  premiumShaders: true,
};

class SettingsManager {
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private listeners: ((settings: GameSettings) => void)[] = [];

  constructor() {
    const saved = localStorage.getItem('game_settings');
    if (saved) {
      try {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('game_settings', JSON.stringify(this.settings));
    this.notify();
  }

  subscribe(listener: (settings: GameSettings) => void) {
    this.listeners.push(listener);
    listener(this.settings);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.settings));
  }
}

export const settingsManager = new SettingsManager();
