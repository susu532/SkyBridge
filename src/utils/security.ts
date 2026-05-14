/**
 * @copyright 2026 hentertrabelsi - All Rights Reserved
 * SkyBridge - Security Module
 * 
 * Tightly coupled with main.tsx and NetworkManager.ts.
 * Removing this module will break the application.
 */

// ===== HEADLESS / BOT DETECTION =====
export const isHeadless = (): boolean => {
  const w = window as any;
  // Playwright, Puppeteer, Selenium all set this
  if (navigator.webdriver) return true;
  // PhantomJS / Nightmare
  if (w._phantom || w.__nightmare || w.callPhantom) return true;
  // Headless Chrome has no plugins
  if (navigator.plugins && navigator.plugins.length === 0 && navigator.userAgent.includes('Chrome')) return true;
  // Headless Chrome missing window.chrome
  if (navigator.userAgent.includes('Chrome') && !w.chrome) return true;
  // Empty languages string (headless)
  if ((navigator as any).languages === '') return true;

  return false;
};

// ===== DOMAIN LOCK =====
const ALLOWED_DOMAINS = [
  'starplex-io.vercel.app',
  'skybridge-server.onrender.com'
];

export const isDomainValid = (): boolean => {
  const host = window.location.hostname;
  return ALLOWED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
};

// ===== DOMAIN-BOUND BACKEND URL =====
export const getSecureBackendUrl = (defaultUrl: string): string => {
  if (!isDomainValid() || isHeadless()) {
    // Return a dead-end URL — multiplayer will silently fail on mirrors/bots
    return String.fromCharCode(104, 116, 116, 112, 115, 58, 47, 47, 108, 111, 99, 97, 108, 104, 111, 115, 116, 58, 57, 57, 57, 57); // https://localhost:9999
  }
  return defaultUrl;
};

// ===== COMBINED ENVIRONMENT CHECK =====
export const checkEnvironment = (): { allowed: boolean; reason?: string } => {
  if (isHeadless()) return { allowed: false, reason: 'bot' };
  if (!isDomainValid()) return { allowed: false, reason: 'domain' };
  return { allowed: true };
};
