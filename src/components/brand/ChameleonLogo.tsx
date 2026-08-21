import React from 'react';

export interface ChameleonLogoProps {
  className?: string;
  size?: number;
  color?: string;
  accentColor?: string;
}

export function ChameleonLogo({
  className = '',
  size = 32,
  color = 'currentColor',
  accentColor = '#FF6B4A',
}: ChameleonLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Monoline Silhouette & Body */}
      <path
        d="M 50 12 C 30 12 16 26 16 45 C 16 62 28 75 42 78 C 36 82 28 84 22 80 C 17 76 16 70 20 65"
        stroke={color}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Curled Spiral Tail (Infinite Loop / Speech Bubble) */}
      <path
        d="M 42 78 C 55 81 72 76 74 60 C 76 46 64 38 52 42 C 43 45 40 56 46 62 C 51 67 60 66 62 60"
        stroke={accentColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Head Crest & Spine Ridge */}
      <path
        d="M 50 12 C 65 12 78 22 82 36 C 85 45 84 54 78 60"
        stroke={color}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Friendly Big Round Eye */}
      <circle
        cx="64"
        cy="32"
        r="11"
        stroke={color}
        strokeWidth="6"
        fill="none"
      />
      <circle
        cx="66"
        cy="30"
        r="4.5"
        fill={accentColor}
      />

      {/* Subtle Friendly Smile */}
      <path
        d="M 76 48 C 72 52 64 52 58 49"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Front Feet */}
      <path
        d="M 38 72 C 36 64 42 58 48 58"
        stroke={color}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
