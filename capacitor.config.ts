import type { CapacitorConfig } from '@capacitor/cli';

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.APP_URL?.trim() ||
  'https://papochan.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.papochan.app',
  appName: 'PapoChan',
  webDir: 'out',
  server: {
    // When compiling for native mobile, points to the live Vercel backend
    url: appUrl,
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

