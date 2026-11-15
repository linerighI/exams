/**
 * Capacitor native mobile configuration wrapping SchoolSync's Vite bundle (`schoolsync/dist`).
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jo.edu.alshereqi.schoolsync',
  appName: 'مدرسة محمد الشريقي',
  webDir: 'schoolsync/dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
