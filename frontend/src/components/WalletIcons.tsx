// WalletIcons.tsx
// Authentic vector SVG logos for Midnight ecosystem wallets and assets.

import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Authentic Lace Wallet SVG Logo
 * The iconic multi-colored Lace spiral vortex / swirl (amber -> magenta -> purple -> cyan)
 * on a clean transparent background.
 */
export function LaceLogo({ size = 20, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <defs>
        <linearGradient id="lace-swirl-grad1" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="35%" stopColor="#ec4899" />
          <stop offset="70%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="lace-swirl-grad2" x1="40" y1="8" x2="8" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="40%" stopColor="#ec4899" />
          <stop offset="75%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Iconic Lace Flowing Swirl / Spiral Vortex — 100% transparent background */}
      <path
        d="M24 5C13.5066 5 5 13.5066 5 24C5 34.4934 13.5066 43 24 43C34.4934 43 43 34.4934 43 24C43 17.8 39.8 12.5 35 9.5"
        stroke="url(#lace-swirl-grad1)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        d="M34 16C37.5 19.5 38 25 35.5 29.5C33 34 28 36.5 23 35.5C18 34.5 14 30 14 25C14 19.5 18.5 15 24 15C27 15 29.5 16.2 31.5 18"
        stroke="url(#lace-swirl-grad2)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Center vortex core */}
      <circle cx="24" cy="24" r="2.5" fill="#ec4899" />
    </svg>
  );
}

/**
 * Authentic 1AM Midnight Wallet SVG Logo (from 1am.xyz)
 * The signature 1AM circular emblem with the 1:00 indicator.
 */
export function OneAmLogo({ size = 20, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        color: '#ffffff',
        ...style,
      }}
    >
      <path
        d="M22.3487 1.34876C29.8067 4.61768 33.6916 13.1099 31.0886 21.0171C28.3273 29.4053 19.31 33.9593 10.9486 31.1885C2.58715 28.4177 -1.95282 19.3711 0.808541 10.9829C3.4091 3.08318 11.5581 -1.41591 19.4825 0.401224L18.5554 3.21739C12.1869 1.90495 5.688 5.56745 3.60067 11.9081C1.35211 18.7386 5.06205 26.1311 11.8707 28.3874C18.6793 30.6436 26.0482 26.9213 28.2967 20.0909C30.3865 13.7427 27.3303 6.90924 21.4218 4.16441L22.3487 1.34876ZM20.0268 3.61162C20.5076 3.77095 20.9729 3.95588 21.4218 4.16441L16.9003 17.8994L14.0347 16.9498L18.5554 3.21739C19.0473 3.31878 19.5385 3.44981 20.0268 3.61162Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Midnight Token (tNIGHT) / Network Emblem
 */
export function MidnightTokenIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <defs>
        <linearGradient id="night-token-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="#0d1127" stroke="url(#night-token-grad)" strokeWidth="1.5" />
      <path
        d="M12 4L14.5 9.5L20 12L14.5 14.5L12 20L9.5 14.5L4 12L9.5 9.5L12 4Z"
        fill="url(#night-token-grad)"
      />
    </svg>
  );
}

/**
 * Universal Wallet Icon that prioritizes dynamic injected extension icon,
 * falling back to authentic transparent SVG logos.
 */
interface WalletIconProps extends IconProps {
  type?: 'lace' | '1am' | string;
  iconUrl?: string;
  alt?: string;
}

export function WalletIcon({ type, iconUrl, size = 20, className, style, alt }: WalletIconProps) {
  const [imgError, setImgError] = React.useState(false);

  // If iconUrl is available and valid, render the authentic injected icon
  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt={alt || `${type || 'wallet'} logo`}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          ...style,
        }}
        onError={() => setImgError(true)}
      />
    );
  }

  const normalized = (type || '').toLowerCase();
  if (normalized.includes('lace') || normalized === 'mnlace') {
    return <LaceLogo size={size} className={className} style={style} />;
  }
  if (normalized.includes('1am') || normalized === 'oneam') {
    return <OneAmLogo size={size} className={className} style={style} />;
  }

  return <MidnightTokenIcon size={size} className={className} style={style} />;
}
