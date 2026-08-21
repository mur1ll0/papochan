'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SerializedIdentity,
  getOrCreateLocalIdentity,
  saveLocalIdentity,
  clearLocalIdentity,
} from '@/core/crypto/storage';
import { computeKeyFingerprint } from '@/core/crypto/keygen';
import { getApiEndpoint } from '@/lib/api';

export function useCrypto() {
  const [identity, setIdentity] = useState<SerializedIdentity | null>(null);
  const [fingerprint, setFingerprint] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize or load identity from IndexedDB
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const id = await getOrCreateLocalIdentity();
        if (!isMounted) return;

        setIdentity(id);
        const fp = await computeKeyFingerprint(id.publicKeyDh);
        setFingerprint(fp);

        // Sync public keys with backend in background
        fetch(getApiEndpoint('/api/auth/device'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: id.userId,
            username: id.username,
            displayName: id.username,
            deviceId: id.deviceId,
            deviceName: id.deviceName,
            deviceType: id.deviceType,
            publicKeyEd: id.publicKeyEd,
            publicKeyDh: id.publicKeyDh,
          }),
        }).catch((err) => {
          console.warn('[useCrypto] Background sync warning:', err);
        });
      } catch (err) {
        console.error('[useCrypto] Failed to initialize identity:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateProfile = useCallback(
    async (username: string, deviceName: string) => {
      if (!identity) return;

      const updated: SerializedIdentity = {
        ...identity,
        username,
        deviceName,
      };

      await saveLocalIdentity(updated);
      setIdentity(updated);

      // Re-sync with backend
      await fetch(getApiEndpoint('/api/auth/device'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: updated.userId,
          username: updated.username,
          displayName: updated.username,
          deviceId: updated.deviceId,
          deviceName: updated.deviceName,
          deviceType: updated.deviceType,
          publicKeyEd: updated.publicKeyEd,
          publicKeyDh: updated.publicKeyDh,
        }),
      }).catch(() => {});
    },
    [identity]
  );

  const wipeIdentity = useCallback(async () => {
    await clearLocalIdentity();
    const newId = await getOrCreateLocalIdentity();
    setIdentity(newId);
    const fp = await computeKeyFingerprint(newId.publicKeyDh);
    setFingerprint(fp);
  }, []);

  return {
    identity,
    fingerprint,
    isLoading,
    updateProfile,
    wipeIdentity,
  };
}
