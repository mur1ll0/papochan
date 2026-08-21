'use client';

import React from 'react';
import { Smartphone, Monitor, Globe, Share2, Mic, Video, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiDeviceBadgeProps {
  deviceType: 'desktop' | 'mobile' | 'browser';
  deviceName: string;
  isScreenShare?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  className?: string;
}

export function MultiDeviceBadge({
  deviceType,
  deviceName,
  isScreenShare = false,
  hasAudio = false,
  hasVideo = false,
  className,
}: MultiDeviceBadgeProps) {
  const getIcon = () => {
    if (isScreenShare) return <Share2 className="w-3 h-3 text-cipher-cyan" />;
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-3 h-3 text-emerald-400" />;
      case 'desktop':
        return <Monitor className="w-3 h-3 text-blue-400" />;
      default:
        return <Globe className="w-3 h-3 text-slate-300" />;
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono tracking-tight backdrop-blur-md border transition-all',
        isScreenShare
          ? 'bg-cipher-cyan/10 border-cipher-cyan/30 text-cipher-cyan'
          : 'bg-tactical-850/80 border-tactical-700/60 text-slate-300',
        className
      )}
      title={`${deviceName} (${deviceType})`}
    >
      {getIcon()}
      <span className="truncate max-w-[110px] font-medium">{deviceName}</span>

      {/* Capability Dots */}
      <div className="flex items-center gap-1 ml-0.5 opacity-75">
        {hasAudio && <Mic className="w-2.5 h-2.5 text-emerald-400" />}
        {hasVideo && <Video className="w-2.5 h-2.5 text-cyan-400" />}
        {isScreenShare && <span className="text-[10px] font-bold">60FPS</span>}
      </div>
    </div>
  );
}
