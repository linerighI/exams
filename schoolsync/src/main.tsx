/**
 * Client entry mounting React application and modular stylesheets.
 */
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
import './staff-jordan.css';
import './staff-cards.css';
import './schedule-pro.css';
import './canvas-admin.css';
import './staff/student-profile.css';
import './schoolsync-ui/transitions.css';
import './schoolsync-ui/components.css';
import './schoolsync-ui/winui-tokens.css';
import './schoolsync-ui/winui-controls.css';
import './schoolsync-ui/winui-sidebar.css';
import './mobile-native.css';
import './responsive-modes.css';
import './prism-login.css';
import './components/orb-dialog.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
