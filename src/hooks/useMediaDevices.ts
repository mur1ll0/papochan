'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MediaEngine, MediaDevicesList } from '@/core/webrtc/MediaEngine';
import { AudioDiagnosticsMetrics } from '@/core/webrtc/AudioDiagnostics';
import { NoiseSuppressionMode } from '@/core/webrtc/NoiseSuppressionEngine';

export interface UseMediaDevicesOptions {
  autoStart?: boolean;
  initialAudio?: boolean;
  initialVideo?: boolean;
  initialNoiseSuppression?: NoiseSuppressionMode;
}

export function useMediaDevices(options: UseMediaDevicesOptions = {}) {
  const {
    autoStart = false,
    initialAudio = true,
    initialVideo = true,
    initialNoiseSuppression = 'ai-neural',
  } = options;

  const engineRef = useRef<MediaEngine | null>(null);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(!initialAudio);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(!initialVideo);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [hasScreenAudio, setHasScreenAudio] = useState<boolean>(false);
  const [isScreenAudioMuted, setIsScreenAudioMuted] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [audioDiagnostics, setAudioDiagnostics] = useState<AudioDiagnosticsMetrics | null>(null);
  const [noiseSuppressionMode, setNoiseSuppressionModeState] = useState<NoiseSuppressionMode>(initialNoiseSuppression);

  const [devices, setDevices] = useState<MediaDevicesList>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');

  const refreshDevices = useCallback(async () => {
    const devs = await MediaEngine.listDevices();
    setDevices(devs);
    if (devs.audioInputs.length && !selectedAudioDevice) {
      setSelectedAudioDevice(devs.audioInputs[0].deviceId);
    }
    if (devs.videoInputs.length && !selectedVideoDevice) {
      setSelectedVideoDevice(devs.videoInputs[0].deviceId);
    }
    if (devs.audioOutputs.length && !selectedAudioOutput) {
      setSelectedAudioOutput(devs.audioOutputs[0].deviceId);
    }
  }, [selectedAudioDevice, selectedVideoDevice, selectedAudioOutput]);

  // Instantiate MediaEngine singleton
  useEffect(() => {
    const engine = new MediaEngine({
      audioDeviceId: selectedAudioDevice || undefined,
      videoDeviceId: selectedVideoDevice || undefined,
      audioOutputId: selectedAudioOutput || undefined,
      noiseSuppressionMode: initialNoiseSuppression,
    });
    engineRef.current = engine;

    engine.onVolume((vol) => {
      setAudioLevel(vol);
    });

    engine.onDiagnostics((metrics) => {
      setAudioDiagnostics(metrics);
    });

    engine.onDeviceChange((updatedDevices) => {
      setDevices(updatedDevices);
    });

    engine.onScreenShareEnded(() => {
      setScreenStream(null);
      setIsScreenSharing(false);
      setHasScreenAudio(false);
      setIsScreenAudioMuted(false);
    });

    // Enumerate hardware devices
    refreshDevices();

    if (autoStart) {
      engine
        .startUserMedia(initialAudio, initialVideo)
        .then((stream) => {
          setUserStream(stream);
          setIsAudioMuted(!initialAudio);
          setIsVideoMuted(!initialVideo);
          refreshDevices();
        })
        .catch((err) => {
          console.warn('[useMediaDevices] Auto-start user media failed:', err);
        });
    }

    return () => {
      engine.destroy();
    };
  }, []);

  const startMedia = useCallback(
    async (audio = true, video = true) => {
      if (!engineRef.current) return null;
      try {
        const stream = await engineRef.current.startUserMedia(audio, video);
        setUserStream(stream);
        setIsAudioMuted(!audio);
        setIsVideoMuted(!video);
        await refreshDevices();
        return stream;
      } catch (err) {
        console.error('[useMediaDevices] startMedia error:', err);
        throw err;
      }
    },
    [refreshDevices]
  );

  const toggleAudio = useCallback(async () => {
    if (!engineRef.current) return false;
    const isNowActive = await engineRef.current.toggleAudio();
    setIsAudioMuted(!isNowActive);

    const stream = engineRef.current.getUserStream();
    if (stream) {
      setUserStream(new MediaStream(stream.getTracks()));
    }
    return isNowActive;
  }, []);

  const toggleVideo = useCallback(async () => {
    if (!engineRef.current) return false;
    const isNowActive = await engineRef.current.toggleVideo();
    setIsVideoMuted(!isNowActive);

    const stream = engineRef.current.getUserStream();
    if (stream) {
      setUserStream(new MediaStream(stream.getTracks()));
    }
    return isNowActive;
  }, []);

  const setNoiseSuppressionMode = useCallback((mode: NoiseSuppressionMode) => {
    setNoiseSuppressionModeState(mode);
    engineRef.current?.setNoiseSuppressionMode(mode);
  }, []);

  const startScreenShare = useCallback(
    async (includeAudio = true, frameRate = 60) => {
      if (!engineRef.current) return null;
      try {
        const stream = await engineRef.current.startScreenShare(includeAudio, frameRate);
        setScreenStream(stream);
        setIsScreenSharing(true);
        setHasScreenAudio(engineRef.current.hasScreenAudio);
        setIsScreenAudioMuted(false);
        return stream;
      } catch (err) {
        console.warn('[useMediaDevices] Screen share start cancelled or rejected:', err);
        setScreenStream(null);
        setIsScreenSharing(false);
        setHasScreenAudio(false);
        throw err;
      }
    },
    []
  );

  const stopScreenShare = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.stopScreenShare();
    setScreenStream(null);
    setIsScreenSharing(false);
    setHasScreenAudio(false);
    setIsScreenAudioMuted(false);
  }, []);

  const toggleScreenShare = useCallback(
    async (includeAudio = true, frameRate = 60) => {
      if (isScreenSharing) {
        stopScreenShare();
        return null;
      } else {
        return startScreenShare(includeAudio, frameRate);
      }
    },
    [isScreenSharing, startScreenShare, stopScreenShare]
  );

  const toggleScreenAudio = useCallback(() => {
    if (!engineRef.current) return false;
    const isNowActive = engineRef.current.toggleScreenAudio();
    setIsScreenAudioMuted(!isNowActive);
    return isNowActive;
  }, []);

  const switchDevice = useCallback(
    async (kind: 'audio' | 'video' | 'output', deviceId: string) => {
      if (kind === 'audio') setSelectedAudioDevice(deviceId);
      if (kind === 'video') setSelectedVideoDevice(deviceId);
      if (kind === 'output') {
        setSelectedAudioOutput(deviceId);
        engineRef.current?.setAudioOutput(deviceId);
        return;
      }

      if (engineRef.current) {
        engineRef.current.setDeviceConfig({
          audioDeviceId: kind === 'audio' ? deviceId : selectedAudioDevice,
          videoDeviceId: kind === 'video' ? deviceId : selectedVideoDevice,
        });

        if (userStream) {
          const currentAudio = !isAudioMuted;
          const currentVideo = !isVideoMuted;
          const stream = await engineRef.current.startUserMedia(currentAudio, currentVideo);
          setUserStream(stream);
        }
      }
    },
    [userStream, isAudioMuted, isVideoMuted, selectedAudioDevice, selectedVideoDevice]
  );

  return {
    engine: engineRef.current,
    userStream,
    screenStream,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    hasScreenAudio,
    isScreenAudioMuted,
    audioLevel,
    audioDiagnostics,
    noiseSuppressionMode,
    devices,
    selectedAudioDevice,
    selectedVideoDevice,
    selectedAudioOutput,
    startMedia,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    toggleScreenAudio,
    setNoiseSuppressionMode,
    switchDevice,
    refreshDevices,
  };
}
