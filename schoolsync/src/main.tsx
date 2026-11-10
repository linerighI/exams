import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import App from './App';
import './style.css';
import './exams-identity.css';
import './family-experience.css';
import './school-experience.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
