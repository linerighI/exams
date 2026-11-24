/**
 * Entry point for App #1: SchoolSync Server Console WebApp.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import './console.css';
import { ServerConsoleApp } from './ServerConsoleApp';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ServerConsoleApp />
  </React.StrictMode>,
);
