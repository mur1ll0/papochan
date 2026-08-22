'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PlatformType,
  isNativeApp,
  getNativePlatform,
  getClientAppVersion,
  compareSemver,
} from '@/lib/platform';
import { getApiEndpoint } from '@/lib/api';

export interface AppVersionState {
  isChecking: boolean;
  isNative: boolean;
  platform: PlatformType | null;
  currentVersion: string;
  latestVersion: string;
  minVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  needsUpdate: boolean;
  isMandatory: boolean;
  isOutdated: boolean;
  isUnsupported: boolean;
  isDismissed: boolean;
  dismissUpdate: () => void;
  checkVersion: () => Promise<void>;
}

export function useAppVersion(): AppVersionState {
  const [isChecking, setIsChecking] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState<PlatformType | null>(null);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [latestVersion, setLatestVersion] = useState('1.0.0');
  const [minVersion, setMinVersion] = useState('1.0.0');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [isMandatory, setIsMandatory] = useState(false);
  const [isOutdated, setIsOutdated] = useState(false);
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkVersion = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const native = isNativeApp();
    setIsNative(native);

    const plat = getNativePlatform();
    setPlatform(plat);

    // If not running in native app wrapper, no native update check is needed
    if (!native || !plat) {
      return;
    }

    setIsChecking(true);
    try {
      const clientVer = await getClientAppVersion();
      setCurrentVersion(clientVer);

      const endpoint = getApiEndpoint(
        `/api/app-version?platform=${encodeURIComponent(plat)}&clientVersion=${encodeURIComponent(clientVer)}`
      );

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const data = await res.json();
      if (data.success) {
        setLatestVersion(data.latestVersion);
        setMinVersion(data.minVersion);
        setDownloadUrl(data.downloadUrl);
        setReleaseNotes(data.releaseNotes || '');

        const outdated = compareSemver(clientVer, data.latestVersion) < 0;
        const unsupported = compareSemver(clientVer, data.minVersion) < 0;
        const mandatory = data.isMandatory || unsupported;

        setIsOutdated(outdated);
        setIsUnsupported(unsupported);
        setIsMandatory(mandatory);
        setNeedsUpdate(outdated || unsupported);
      }
    } catch (err) {
      console.warn('[useAppVersion] Version check failed (offline or network error):', err);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  const dismissUpdate = () => {
    if (!isMandatory) {
      setIsDismissed(true);
    }
  };

  return {
    isChecking,
    isNative,
    platform,
    currentVersion,
    latestVersion,
    minVersion,
    downloadUrl,
    releaseNotes,
    needsUpdate,
    isMandatory,
    isOutdated,
    isUnsupported,
    isDismissed,
    dismissUpdate,
    checkVersion,
  };
}
