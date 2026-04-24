export const isHeadless = (): boolean => {
  const w = window as any;
  if (navigator.webdriver) return true;
  if (w._phantom || w.__nightmare || w.callPhantom) return true;
  if (navigator.languages === "") return true;
  
  if (navigator.userAgent.includes('Chrome') && !w.chrome) {
    return true;
  }
  
  return false;
};

const ALLOWED_DOMAINS = [
  'sky-bridge-teal-two.vercel.app',
  'skybridge-server.onrender.com'
];

export const isDomainValid = (): boolean => {
  const host = window.location.hostname;
  return ALLOWED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
};

export const getSecureBackendUrl = (defaultUrl: string): string => {
  if (!isDomainValid() || isHeadless()) {
    return String.fromCharCode(104, 116, 116, 112, 115, 58, 47, 47, 108, 111, 99, 97, 108, 104, 111, 115, 116, 58, 57, 57, 57, 57); // https://localhost:9999
  }
  return defaultUrl;
};
