import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { checkEnvironment } from './utils/security';
import './index.css';

const rootElement = document.getElementById('root')!;
const { allowed } = checkEnvironment();

if (!allowed) {
  // Fake loading screen — bots/mirrors see this forever
  rootElement.innerHTML = '<div style="width:100vw;height:100vh;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;font-family:monospace;">Loading Assets...</div>';
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
