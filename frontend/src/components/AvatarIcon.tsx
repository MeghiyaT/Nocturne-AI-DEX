/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import {
  ShieldCheck,
  Shield,
  KeyRound,
  Cpu,
  Database,
  Fingerprint,
  Orbit,
  Lock,
  Compass,
  Sparkles,
  Layers,
  Terminal,
  Gem,
  Binary,
  Bot,
  Activity
} from 'lucide-react';

export type AvatarId =
  | 'shield'
  | 'vault'
  | 'key'
  | 'cpu'
  | 'database'
  | 'fingerprint'
  | 'orbit'
  | 'lock'
  | 'compass'
  | 'sparkle'
  | 'layers'
  | 'terminal'
  | 'gem'
  | 'binary'
  | 'bot'
  | 'activity';

export const AVATAR_OPTIONS: { id: AvatarId; label: string }[] = [
  { id: 'shield', label: 'Shield' },
  { id: 'vault', label: 'Vault' },
  { id: 'key', label: 'Secret Key' },
  { id: 'cpu', label: 'Neural CPU' },
  { id: 'database', label: 'Data Lake' },
  { id: 'fingerprint', label: 'Biometrics' },
  { id: 'orbit', label: 'Orbit Ring' },
  { id: 'lock', label: 'ZK Lock' },
  { id: 'compass', label: 'Navigator' },
  { id: 'sparkle', label: 'Synthesizer' },
  { id: 'layers', label: 'Consensus' },
  { id: 'terminal', label: 'Kernel' },
  { id: 'gem', label: 'Prism' },
  { id: 'binary', label: 'Matrix' },
  { id: 'bot', label: 'Autonomous' },
  { id: 'activity', label: 'Signal' },
];

export interface AvatarIconProps {
  id?: string;
  avatarId?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AvatarIcon({ id, avatarId, size = 20, className, style }: AvatarIconProps) {
  const chosen = avatarId || id || 'shield';
  const normalized = chosen.toLowerCase().trim();

  const iconProps = {
    size,
    className,
    style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style },
  };

  switch (normalized) {
    case 'vault':
      return <ShieldCheck {...iconProps} />;
    case 'key':
      return <KeyRound {...iconProps} />;
    case 'cpu':
      return <Cpu {...iconProps} />;
    case 'database':
      return <Database {...iconProps} />;
    case 'fingerprint':
      return <Fingerprint {...iconProps} />;
    case 'orbit':
      return <Orbit {...iconProps} />;
    case 'lock':
      return <Lock {...iconProps} />;
    case 'compass':
      return <Compass {...iconProps} />;
    case 'sparkle':
      return <Sparkles {...iconProps} />;
    case 'layers':
      return <Layers {...iconProps} />;
    case 'terminal':
      return <Terminal {...iconProps} />;
    case 'gem':
      return <Gem {...iconProps} />;
    case 'binary':
      return <Binary {...iconProps} />;
    case 'bot':
      return <Bot {...iconProps} />;
    case 'activity':
      return <Activity {...iconProps} />;
    case 'shield':
    default:
      return <Shield {...iconProps} />;
  }
}
