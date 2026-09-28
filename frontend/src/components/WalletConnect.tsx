// WalletConnect.tsx
// Nocturne AI — Apple-Grade Minimalist Wallet Connector
// Supports Lace and 1AM extensions with clean dark frosted glass aesthetics.

import { useState } from 'react';
import type { MidnightHook } from '../hooks/useMidnight';
import { WALLET_INSTALL_URLS, normalizeNetwork } from '../hooks/useMidnight';
import { WalletIcon } from './WalletIcons';
import { COPY_FEEDBACK_MS } from '../config';
import {
  ChevronDown,
  Check,
  Copy,
  Info,
  ExternalLink,
  LogOut,
  X,
  Wallet,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  hook: MidnightHook;
}

function truncate(addr: string): string {
  if (!addr || addr.length < 24) return addr;
  return `${addr.slice(0, 16)}…${addr.slice(-6)}`;
}

export function WalletConnect({ hook }: Props) {
  const {
    walletState,
    connect,
    disconnect,
    targetNetwork,
    isLaceAvailable,
    is1amAvailable,
    switchNotification,
    clearSwitchNotification,
  } = hook;

  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const isMismatch =
    walletState.status === 'connected' &&
    !!(
      walletState.isNetworkMismatch ||
      hook.isNetworkMismatch ||
      (walletState.network && targetNetwork && normalizeNetwork(walletState.network) !== normalizeNetwork(targetNetwork))
    );

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  const handleSwitch = async (type: '1am' | 'lace') => {
    setIsSwitching(true);
    await connect(type);
    setIsSwitching(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Disconnected State ────────────────────────────────────────────── */}
      {walletState.status === 'idle' && (
        <div>
          <button
            id="btn-connect-wallet"
            className="btn btn-primary btn-sm"
            onClick={() => setShowMenu(!showMenu)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}
          >
            <Wallet size={15} />
            <span>Connect Wallet</span>
            <ChevronDown size={14} style={{ opacity: 0.7 }} />
          </button>

          {showMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: 320,
                maxWidth: 'calc(100vw - 2rem)',
                background: 'var(--bg-modal)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                padding: '1.2rem',
                boxShadow: 'var(--shadow-modal)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                zIndex: 1000,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Connect Wallet
                </div>
                <span className="badge" style={{ fontSize: '0.65rem' }}>
                  {targetNetwork.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.45 }}>
                Select a Midnight wallet extension to sign transactions and verify datasets.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {/* 1AM Wallet */}
                {is1amAvailable ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowMenu(false);
                      connect('1am');
                    }}
                    style={{
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <WalletIcon type="1am" iconUrl={hook.oneAmIcon} size={20} />
                      <span style={{ fontWeight: 600 }}>1AM Wallet</span>
                    </span>
                    <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                      <Check size={11} /> Ready
                    </span>
                  </button>
                ) : (
                  <a
                    href={WALLET_INSTALL_URLS['1am']}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      textDecoration: 'none',
                      opacity: 0.85,
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <WalletIcon type="1am" iconUrl={hook.oneAmIcon} size={20} />
                      <span>1AM Wallet</span>
                    </span>
                    <span className="badge badge-subtle" style={{ fontSize: '0.65rem' }}>
                      Install <ExternalLink size={10} style={{ marginLeft: 2 }} />
                    </span>
                  </a>
                )}

                {/* Lace */}
                {isLaceAvailable ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowMenu(false);
                      connect('lace');
                    }}
                    style={{
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <WalletIcon type="lace" iconUrl={hook.laceIcon} size={20} />
                      <span style={{ fontWeight: 600 }}>Lace</span>
                    </span>
                    <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                      <Check size={11} /> Ready
                    </span>
                  </button>
                ) : (
                  <a
                    href={WALLET_INSTALL_URLS.lace}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      textDecoration: 'none',
                      opacity: 0.85,
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <WalletIcon type="lace" iconUrl={hook.laceIcon} size={20} />
                      <span>Lace</span>
                    </span>
                    <span className="badge badge-subtle" style={{ fontSize: '0.65rem' }}>
                      Install <ExternalLink size={10} style={{ marginLeft: 2 }} />
                    </span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Connecting State ─────────────────────────────────────────────── */}
      {walletState.status === 'connecting' && (
        <button className="btn btn-secondary btn-sm" disabled style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Connecting…</span>
        </button>
      )}

      {/* ── Error / Unlock Required State ───────────────────────────────── */}
      {walletState.status === 'error' && (
        <div style={{ position: 'relative' }}>
          <button
            id="btn-reconnect-wallet"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowMenu(!showMenu)}
            style={{
              borderColor: 'rgba(255, 69, 58, 0.4)',
              color: 'var(--accent-rose)',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Info size={13} />
            <span>{walletState.message.toLowerCase().includes('unlock') ? 'Unlock Wallet' : 'Connection Notice'}</span>
            <ChevronDown size={13} style={{ opacity: 0.7 }} />
          </button>

          {showMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: 320,
                maxWidth: 'calc(100vw - 2rem)',
                background: 'var(--bg-modal)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                boxShadow: 'var(--shadow-modal)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                zIndex: 1000,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                  <Info size={16} color="var(--accent-rose)" />
                  <span>Wallet Unlock Required</span>
                </div>
                <button
                  onClick={() => setShowMenu(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={14} />
                </button>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.45 }}>
                Your browser wallet extension is currently locked. Unlock your wallet and retry:
              </p>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => {
                    hook.clearError();
                    setShowMenu(false);
                  }}
                >
                  Dismiss
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => {
                    hook.clearError();
                    connect(isLaceAvailable ? 'lace' : '1am');
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Connected State ──────────────────────────────────────────────── */}
      {walletState.status === 'connected' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Balance Pill */}
            <div
              style={{
                padding: '0.35rem 0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <span className="mono">{walletState.balance}</span>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '0.12rem 0.4rem',
                  borderRadius: '4px',
                  background: isMismatch ? 'rgba(229, 169, 80, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                  color: isMismatch ? '#e5a950' : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {walletState.network}
              </span>
            </div>

            {/* Wrong Network Indicator Pill in Header */}
            {isMismatch && (
              <div
                style={{
                  padding: '0.35rem 0.7rem',
                  background: 'rgba(229, 169, 80, 0.08)',
                  border: '1px solid rgba(229, 169, 80, 0.25)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.74rem',
                  fontWeight: 500,
                  color: '#e5a950',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                title={`Wallet network (${walletState.network.toUpperCase()}) does not match DApp target (${hook.targetNetwork.toUpperCase()})`}
              >
                <AlertTriangle size={12} style={{ color: '#e5a950', opacity: 0.9 }} />
                <span>Wrong Net ({walletState.network.toUpperCase()})</span>
              </div>
            )}

            {/* Connected Address & Wallet Trigger */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowMenu(!showMenu)}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <WalletIcon type={walletState.walletType} iconUrl={walletState.iconUrl} size={16} />
              <span className="mono">{truncate(walletState.address)}</span>
              <ChevronDown size={13} style={{ opacity: 0.7 }} />
            </button>

            {showMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: 330,
                  maxWidth: 'calc(100vw - 2rem)',
                  background: 'var(--bg-modal)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.1rem',
                  boxShadow: 'var(--shadow-modal)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  zIndex: 1000,
                }}
              >
                {/* Header Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <WalletIcon type={walletState.walletType} iconUrl={walletState.iconUrl} size={18} />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                      {walletState.connectorName}
                    </span>
                  </div>
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.65rem',
                      background: isMismatch ? 'rgba(229, 169, 80, 0.1)' : undefined,
                      color: isMismatch ? '#e5a950' : undefined,
                      border: isMismatch ? '1px solid rgba(229, 169, 80, 0.25)' : undefined,
                    }}
                  >
                    {walletState.network.toUpperCase()} {isMismatch ? '⚠ MISMATCH' : '✓'}
                  </span>
                </div>

                {/* Network Mismatch Warning Banner */}
                {isMismatch && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(229, 169, 80, 0.22)',
                      borderLeft: '3px solid #e5a950',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem 0.85rem',
                      marginBottom: '0.75rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.45,
                    }}
                  >
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>
                      <AlertTriangle size={13} style={{ color: '#e5a950' }} /> Network Mismatch
                    </div>
                    Your {walletState.connectorName} is connected to <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{walletState.network.toUpperCase()}</span>, but this DEX targets <span style={{ color: '#e5a950', fontWeight: 600 }}>{hook.targetNetwork.toUpperCase()}</span>.
                    Please switch to <span style={{ color: '#e5a950', fontWeight: 600 }}>{hook.targetNetwork.toUpperCase()}</span> in your wallet extension settings to transact.
                  </div>
                )}

              {/* Inline Switch / Status Notification */}
              {switchNotification && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.75rem',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.78rem' }}>
                      <Info size={13} />
                      <span>Notification</span>
                    </div>
                    <button
                      onClick={clearSwitchNotification}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {switchNotification}
                  </div>
                </div>
              )}

              {/* Address Box */}
              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginBottom: '0.25rem', letterSpacing: '0.04em', fontWeight: 600 }}>
                  CONNECTED ADDRESS
                </div>
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.74rem',
                    color: 'var(--text-main)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span className="mono">{truncate(walletState.address)}</span>
                  <button
                    onClick={() => copy(walletState.address)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--border-subtle)',
                      color: copied ? 'var(--accent-emerald)' : 'var(--text-main)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.2rem 0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Switch Wallet Section */}
              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginBottom: '0.35rem', letterSpacing: '0.04em', fontWeight: 600 }}>
                  SWITCH WALLET
                </div>
                {walletState.walletType === '1am' ? (
                  isLaceAvailable ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={isSwitching}
                      onClick={() => handleSwitch('lace')}
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        padding: '0.55rem 0.75rem',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <WalletIcon type="lace" iconUrl={hook.laceIcon} size={18} />
                        <span>Switch to Lace</span>
                      </span>
                      <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>
                        {isSwitching ? '...' : 'Ready'}
                      </span>
                    </button>
                  ) : (
                    <a
                      href={WALLET_INSTALL_URLS.lace}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        padding: '0.55rem 0.75rem',
                        textDecoration: 'none',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <WalletIcon type="lace" iconUrl={hook.laceIcon} size={18} />
                        <span>Get Lace</span>
                      </span>
                      <span className="badge badge-subtle" style={{ fontSize: '0.62rem' }}>
                        Install <ExternalLink size={9} style={{ marginLeft: 2 }} />
                      </span>
                    </a>
                  )
                ) : is1amAvailable ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={isSwitching}
                    onClick={() => handleSwitch('1am')}
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      padding: '0.55rem 0.75rem',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <WalletIcon type="1am" iconUrl={hook.oneAmIcon} size={18} />
                      <span>Switch to 1AM Wallet</span>
                    </span>
                    <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>
                      {isSwitching ? '...' : 'Ready'}
                    </span>
                  </button>
                ) : (
                  <a
                    href={WALLET_INSTALL_URLS['1am']}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      padding: '0.55rem 0.75rem',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <WalletIcon type="1am" iconUrl={hook.oneAmIcon} size={18} />
                      <span>Get 1AM Wallet</span>
                    </span>
                    <span className="badge badge-subtle" style={{ fontSize: '0.62rem' }}>
                      Install <ExternalLink size={9} style={{ marginLeft: 2 }} />
                    </span>
                  </a>
                )}
              </div>

              {/* Disconnect Action */}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  disconnect();
                  setShowMenu(false);
                }}
                style={{
                  width: '100%',
                  color: 'var(--accent-rose)',
                  fontSize: '0.78rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.6rem',
                  justifyContent: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <LogOut size={13} />
                <span>Disconnect</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
