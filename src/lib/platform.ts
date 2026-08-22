export type PlatformType = 'windows' | 'android' | 'ios' | 'macos' | 'linux' | 'web';

export interface PlatformMetadata {
  id: PlatformType;
  name: string;
  shortName: string;
  badge: string;
  fileExt: string;
  defaultDownloadUrl: string;
  guideType: 'smartscreen' | 'playprotect' | 'ios_pwa' | 'gatekeeper' | 'linux_perm';
}

const ghRepo = process.env.NEXT_PUBLIC_GITHUB_REPO?.replace(/^\/+|\/+$/g, '');
const ghBaseUrl = ghRepo ? `https://github.com/${ghRepo}/releases/latest/download` : '';

export const PLATFORMS_CONFIG: Record<PlatformType, PlatformMetadata> = {
  windows: {
    id: 'windows',
    name: 'Windows 10 / 11 (64-bit)',
    shortName: 'Windows',
    badge: 'EXE / MSI',
    fileExt: '.exe',
    defaultDownloadUrl:
      process.env.NEXT_PUBLIC_DOWNLOAD_WINDOWS ||
      (ghBaseUrl ? `${ghBaseUrl}/papochan-setup.exe` : '/downloads/papochan-setup.exe'),
    guideType: 'smartscreen',
  },
  android: {
    id: 'android',
    name: 'Android (APK Direto)',
    shortName: 'Android',
    badge: 'APK',
    fileExt: '.apk',
    defaultDownloadUrl:
      process.env.NEXT_PUBLIC_DOWNLOAD_ANDROID ||
      (ghBaseUrl ? `${ghBaseUrl}/papochan.apk` : '/downloads/papochan.apk'),
    guideType: 'playprotect',
  },
  ios: {
    id: 'ios',
    name: 'iPhone / iPad (iOS)',
    shortName: 'iOS / iPad',
    badge: 'PWA / IPA',
    fileExt: '.ipa',
    defaultDownloadUrl:
      process.env.NEXT_PUBLIC_DOWNLOAD_IOS ||
      (ghBaseUrl ? `${ghBaseUrl}/papochan.ipa` : '/downloads/papochan.ipa'),
    guideType: 'ios_pwa',
  },
  macos: {
    id: 'macos',
    name: 'macOS (Intel / Apple Silicon)',
    shortName: 'macOS',
    badge: 'DMG',
    fileExt: '.dmg',
    defaultDownloadUrl:
      process.env.NEXT_PUBLIC_DOWNLOAD_MACOS ||
      (ghBaseUrl ? `${ghBaseUrl}/papochan.dmg` : '/downloads/papochan.dmg'),
    guideType: 'gatekeeper',
  },
  linux: {
    id: 'linux',
    name: 'Linux (AppImage / DEB)',
    shortName: 'Linux',
    badge: 'AppImage',
    fileExt: '.AppImage',
    defaultDownloadUrl:
      process.env.NEXT_PUBLIC_DOWNLOAD_LINUX ||
      (ghBaseUrl ? `${ghBaseUrl}/papochan.AppImage` : '/downloads/papochan.AppImage'),
    guideType: 'linux_perm',
  },
  web: {
    id: 'web',
    name: 'Web Browser',
    shortName: 'Web',
    badge: 'Web App',
    fileExt: '',
    defaultDownloadUrl: '',
    guideType: 'smartscreen',
  },
};


/**
 * Detects the client operating system based on User-Agent and platform properties.
 */
export function detectOS(): PlatformType {
  if (typeof window === 'undefined') return 'web';

  // Check Capacitor native platform first if running in wrapper
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) {
    const platform = cap.getPlatform?.();
    if (platform === 'android') return 'android';
    if (platform === 'ios') return 'ios';
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platformStr = window.navigator.platform?.toLowerCase() || '';

  // Android check
  if (/android/i.test(userAgent)) {
    return 'android';
  }

  // iOS check (iPhone, iPod, or iPad with iPadOS pretending to be MacIntel with touch support)
  const isIOS =
    /iphone|ipad|ipod/i.test(userAgent) ||
    (platformStr.includes('mac') && window.navigator.maxTouchPoints > 1);
  if (isIOS) {
    return 'ios';
  }

  // Windows check
  if (/windows|win32|win64/i.test(userAgent) || platformStr.includes('win')) {
    return 'windows';
  }

  // macOS check
  if (/macintosh|mac os x/i.test(userAgent) || platformStr.includes('mac')) {
    return 'macos';
  }

  // Linux check
  if (/linux/i.test(userAgent) || platformStr.includes('linux')) {
    return 'linux';
  }

  return 'web';
}

/**
 * Verifies if the web application is running inside a native wrapper (Capacitor or Tauri).
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;

  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  const isCapacitor = !!cap?.isNativePlatform?.();

  const isTauri =
    typeof (window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }).__TAURI_INTERNALS__ !== 'undefined' ||
    typeof (window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }).__TAURI__ !== 'undefined';

  return isCapacitor || isTauri;
}

/**
 * Returns the native platform type if running inside a native shell.
 */
export function getNativePlatform(): PlatformType | null {
  if (!isNativeApp()) return null;

  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  if (cap?.getPlatform) {
    const p = cap.getPlatform();
    if (p === 'android') return 'android';
    if (p === 'ios') return 'ios';
  }

  // Tauri or Desktop Wrapper
  return detectOS();
}

/**
 * Retrieves the version of the installed native wrapper if available.
 */
export async function getClientAppVersion(): Promise<string> {
  if (typeof window === 'undefined') return '1.0.0';

  try {
    // Check localStorage override / cache
    const cached = window.localStorage.getItem('papochan_native_version');
    if (cached) return cached;

    // Check custom global injected variables if present
    const win = window as unknown as Record<string, unknown>;

    if (win.__PAPOCHAN_APP_VERSION__ && typeof win.__PAPOCHAN_APP_VERSION__ === 'string') {
      window.localStorage.setItem('papochan_native_version', win.__PAPOCHAN_APP_VERSION__);
      return win.__PAPOCHAN_APP_VERSION__;
    }

    // Capacitor Native Bridge Version check
    const cap = win.Capacitor as {
      nativeAppVersion?: string;
      getPlatform?: () => string;
      Plugins?: { App?: { getInfo?: () => Promise<{ version?: string }> } };
    } | undefined;

    if (cap?.nativeAppVersion) {
      window.localStorage.setItem('papochan_native_version', cap.nativeAppVersion);
      return cap.nativeAppVersion;
    }

    if (cap?.Plugins?.App?.getInfo) {
      const info = await cap.Plugins.App.getInfo();
      if (info?.version) {
        window.localStorage.setItem('papochan_native_version', info.version);
        return info.version;
      }
    }

    // Tauri Runtime Metadata check
    const tauri = win.__TAURI_INTERNALS__ as { appVersion?: string } | undefined;
    if (tauri?.appVersion) {
      window.localStorage.setItem('papochan_native_version', tauri.appVersion);
      return tauri.appVersion;
    }
  } catch {
    // Ignore errors during runtime inspection
  }

  return '1.0.0';
}


/**
 * Compares two semantic version strings (e.g. "1.2.0" vs "1.2.1").
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *  -1 if v1 < v2 (v1 is older)
 *   0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = (v1 || '0.0.0').replace(/^v/, '').split('-')[0];
  const clean2 = (v2 || '0.0.0').replace(/^v/, '').split('-')[0];

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}
