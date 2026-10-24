import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import StartupScreen from './StartupScreen';
try {
  sessionStorage.setItem('zunis-started-at', String(Date.now()));
} catch {}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StartupScreen loading />
  </React.StrictMode>,
);
