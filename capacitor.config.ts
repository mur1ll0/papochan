import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'network.ghostprotocol.app',
  appName: 'GhostProtocol',
  webDir: 'out',
  server: {
    // When compiling for native mobile, points to the live Vercel backend or local dev server
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
