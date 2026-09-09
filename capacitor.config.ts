import type { CapacitorConfig } from '@capacitor/cli';
import pkg from './package.json';

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.APP_URL?.trim() ||
  'https://papochan.vercel.app';

/**
 * The shell has to announce its own version, because it does not serve the app -
 * it loads the live site, so the JavaScript running inside it is always the
 * newest web build and can learn nothing about the binary hosting it.
 *
 * Announced two ways so one failing is not silent: appended to the user agent,
 * and carried on the URL the shell opens. Both are fixed at the moment the
 * binary is built, which is exactly what "installed version" means.
 */
const SHELL_VERSION = pkg.version;

const shellUrl = (() => {
  const url = new URL(appUrl);
  url.searchParams.set('shell', 'android');
  url.searchParams.set('shellVersion', SHELL_VERSION);
  return url.toString();
})();

const config: CapacitorConfig = {
  appId: 'com.papochan.app',
  appName: 'PapoChan',
  webDir: 'out',
  appendUserAgent: `PapoChanShell/${SHELL_VERSION}`,
  server: {
    // When compiling for native mobile, points to the live Vercel backend
    url: shellUrl,
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

