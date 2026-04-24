import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { UIProvider } from './store/UIStore';
import { isHeadless, isDomainValid } from './utils/security';
import './index.css';

const rootElement = document.getElementById('root')!;

if (isHeadless() || !isDomainValid()) {
  rootElement.innerHTML = '<div style="width: 100vw; height: 100vh; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font-family: monospace;">Loading Assets...</div>';
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <UIProvider>
        <App />
      </UIProvider>
    </StrictMode>,
  );
}
