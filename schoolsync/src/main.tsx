/**
 * Client entry mounting React application and spatial Apple stylesheets.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import App from './App';
import './styles/tokens.css';
import './styles/spatial-hud.css';
import './styles/spatial-callouts.css';
import './styles/floating-windows.css';
import './styles/window-controls.css';
import './styles/window-content.css';
import './styles/family-stage.css';
import './styles/orb-dock.css';
import './styles/campus-editor.css';
import './styles/editor-props.css';
import './styles/liquid-glass.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
