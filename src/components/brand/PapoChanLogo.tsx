import React from 'react';
import { ChameleonLogo } from './ChameleonLogo';
import { PapoChanWordmark } from './PapoChanWordmark';

export interface PapoChanLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  layout?: 'horizontal' | 'vertical';
  variant?: 'color' | 'mono' | 'dark';
  color?: string;
  showWordmark?: boolean;
}

const sizeConfig = {
  sm: { iconSize: 28, wordmarkHeight: 18, gap: 'gap-2' },
  md: { iconSize: 40, wordmarkHeight: 26, gap: 'gap-3' },
  lg: { iconSize: 56, wordmarkHeight: 36, gap: 'gap-3.5' },
  xl: { iconSize: 72, wordmarkHeight: 46, gap: 'gap-4' },
  hero: { iconSize: 110, wordmarkHeight: 52, gap: 'gap-5' },
};

/**
 * PapoChan Official Logo Lockup
 * Supports horizontal and vertical (hero) layouts.
 */
export function PapoChanLogo({
  className = '',
  size = 'md',
  layout = 'horizontal',
  variant = 'dark',
  color,
  showWordmark = true,
}: PapoChanLogoProps) {
  const config = sizeConfig[size] || sizeConfig.md;
  const isVertical = layout === 'vertical';

  const wordmarkColor = color || (variant === 'dark' ? '#FFFFFF' : '#222F3D');

  return (
    <div
      className={`inline-flex ${isVertical ? 'flex-col items-center text-center' : 'items-center'} ${config.gap} ${className}`}
    >
      <ChameleonLogo
        size={config.iconSize}
        variant={variant}
        color={color}
      />
      {showWordmark && (
        <PapoChanWordmark
          height={config.wordmarkHeight}
          color={wordmarkColor}
        />
      )}
    </div>
  );
}
