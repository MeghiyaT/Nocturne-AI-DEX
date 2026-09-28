// useMidnight.ts
// Midnight Wallet Connector — supports Lace & 1AM browser extensions with
// dynamic CAIP-372 wallet discovery and non-destructive switching.
//
// ─── Privacy Note ────────────────────────────────────────────────────────────
// Private witnesses (raw dataset slices, provider secret) NEVER enter React state.
// ────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import { TARGET_NETWORK, WALLET_DETECT_DELAYS } from '../config';

const LACE_ADDRESS_KEY = 'nocturne_lace_address';
const ONEAM_ADDRESS_KEY = 'nocturne_1am_address';
const LAST_WALLET_KEY = 'nocturne_last_wallet';

export const WALLET_INSTALL_URLS = {
  lace: 'https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk',
  '1am': 'https://1am.xyz',
};

function isValidMidnightAddress(addr: string): boolean {
  if (!addr || typeof addr !== 'string') return false;
  const cleaned = addr.trim();
  if (cleaned.length < 15) return false;
  // Reject RDNS / domain names, URLs, package identifiers, or general sentences
  if (
    cleaned.includes('.') ||
    cleaned.includes('/') ||
    cleaned.includes(' ') ||
    cleaned.includes(':') ||
    cleaned.includes('@') ||
    cleaned.includes('-')
  ) {
    return false;
  }
  return (
    cleaned.startsWith('mn_addr') ||
    cleaned.startsWith('mn_dust') ||
    cleaned.startsWith('mn_') ||
    cleaned.startsWith('mn1') ||
    cleaned.startsWith('addr_test1') ||
    cleaned.startsWith('addr1') ||
    cleaned.startsWith('addr_test') ||
    (cleaned.startsWith('0x') && cleaned.length >= 42 && /^0x[0-9a-fA-F]+$/.test(cleaned))
  );
}

// Safely extract an address string from any shape the wallet API might return.
function extractAddr(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (isValidMidnightAddress(trimmed)) return trimmed;
    return '';
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const candidate = extractAddr(item);
      if (candidate && isValidMidnightAddress(candidate)) return candidate;
    }
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const priorityKeys = [
      'unshieldedAddress',
      'shieldedAddress',
      'dustAddress',
      'address',
      'bech32',
      'addr',
      'unshielded',
      'shielded',
      'bech32Address',
      'accountAddress',
      'receivingAddress',
      'changeAddress',
      'usedAddress',
    ];
    for (const key of priorityKeys) {
      if (obj[key] !== undefined) {
        const candidate = extractAddr(obj[key]);
        if (candidate && isValidMidnightAddress(candidate)) return candidate;
      }
    }
    for (const [key, val] of Object.entries(obj)) {
      if (
        key.includes('circuit') ||
        key.includes('contract') ||
        key.includes('wasm') ||
        key.includes('rdns') ||
        key.includes('name') ||
        key.includes('icon') ||
        key.includes('version') ||
        key.includes('id') ||
        key.includes('uri') ||
        key.includes('url')
      ) {
        continue;
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (isValidMidnightAddress(trimmed)) {
          return trimmed;
        }
      } else if (typeof val === 'object' && val !== null) {
        const candidate = extractAddr(val);
        if (candidate && isValidMidnightAddress(candidate)) return candidate;
      }
    }
  }
  return '';
}

export type WalletType = '1am' | 'lace';

export interface DiscoveredWalletInfo {
  id: WalletType | string;
  name: string;
  icon?: string;
  rdns?: string;
  apiVersion?: string;
  isAvailable: boolean;
}

export type WalletState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | {
    status: 'connected';
    address: string;
    balance: string;
    rawBalance: number;
    network: string;
    isNetworkMismatch?: boolean;
    walletType: WalletType;
    connectorName: string;
    iconUrl?: string;
    api: any;
  }
  | { status: 'error'; message: string };

export interface MidnightHook {
  walletState: WalletState;
  connect: (type?: WalletType, isAutoConnect?: boolean) => Promise<boolean>;
  disconnect: () => void;
  clearError: () => void;
  targetNetwork: string;
  isNetworkMismatch: boolean;
  isLaceAvailable: boolean;
  is1amAvailable: boolean;
  laceIcon?: string;
  oneAmIcon?: string;
  switchNotification: string | null;
  clearSwitchNotification: () => void;
  deductBalance: (amount: number, targetAddress?: string) => void;
  creditBalance: (amount: number, targetAddress?: string) => void;
  refreshBalance: () => Promise<void>;
  signAndSubmitPurchaseTx: (
    recipientAddress: string,
    amountNight: number,
    datasetName: string
  ) => Promise<{ success: boolean; txHash: string; promptShown: boolean }>;
}

// Helper with strict timeout
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Safely attempt to connect to a Midnight DApp Connector object with strict timeout
async function tryConnect(connector: any, network: string): Promise<any> {
  if (!connector) return null;

  // If connector is already an active connected API surface
  if (
    typeof connector.getUnshieldedAddress === 'function' ||
    typeof connector.getShieldedAddresses === 'function'
  ) {
    return connector;
  }

  // 1. Midnight DApp Connector v4: connector.connect(network)
  if (typeof connector.connect === 'function') {
    try {
      const api = await withTimeout(connector.connect(network), 3000, null);
      if (api) return api;
    } catch (e) {
      console.warn('[useMidnight] connector.connect(network) attempt:', e);
    }
    try {
      const api = await withTimeout(connector.connect(), 2500, null);
      if (api) return api;
    } catch (e) {
      console.warn('[useMidnight] connector.connect() attempt:', e);
    }
  }

  // 2. CIP-30 / CAIP enable()
  if (typeof connector.enable === 'function') {
    try {
      const api = await withTimeout(connector.enable(network), 2500, null);
      if (api) return api;
    } catch (e) {
      console.warn('[useMidnight] connector.enable(network) attempt:', e);
    }
    try {
      const api = await withTimeout(connector.enable(), 2500, null);
      if (api) return api;
    } catch (e) {
      console.warn('[useMidnight] connector.enable() attempt:', e);
    }
  }

  if (typeof connector.isEnabled === 'function') {
    try {
      const enabled = await withTimeout(connector.isEnabled(), 1000, false);
      if (enabled && typeof connector.getApi === 'function') {
        const api = await withTimeout(connector.getApi(), 1000, null);
        if (api) return api;
      }
    } catch { }
  }

  return null;
}

// Helper to unwrap async promises and RxJS Observables safely with fast timeout
async function resolveValue(valOrFn: any, timeoutMs = 1200): Promise<any> {
  try {
    let val = typeof valOrFn === 'function' ? valOrFn() : valOrFn;
    if (val && typeof val.then === 'function') {
      val = await withTimeout(val, timeoutMs, null);
    }
    if (val && typeof val.subscribe === 'function') {
      val = await new Promise((resolve) => {
        let resolved = false;
        const sub = val.subscribe({
          next: (v: any) => {
            if (v) {
              const testAddr = extractAddr(v);
              if (testAddr && isValidMidnightAddress(testAddr)) {
                resolved = true;
                try { sub?.unsubscribe?.(); } catch { }
                resolve(v);
                return;
              }
            }
            if (!resolved) {
              setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  try { sub?.unsubscribe?.(); } catch { }
                  resolve(v);
                }
              }, 200);
            }
          },
          error: (err: any) => {
            console.warn('[useMidnight] Observable error:', err);
            if (!resolved) {
              resolved = true;
              resolve(null);
            }
          },
        });
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            try { sub?.unsubscribe?.(); } catch { }
            resolve(null);
          }
        }, timeoutMs);
      });
    }
    if (val && typeof val.getValue === 'function') {
      val = val.getValue();
    }
    return val;
  } catch {
    return null;
  }
}

// Safely retrieve address from connected API object across all extensions
async function getWalletAddressFromApi(api: any): Promise<string> {
  if (!api) return '';

  const priorityCandidates: (() => any)[] = [
    () => api.getUnshieldedAddress?.(),
    () => api.getShieldedAddresses?.(),
    () => api.getDustAddress?.(),
    () => api.getAddress?.(),
    () => api.getAddresses?.(),
    () => api.getUsedAddresses?.(),
    () => api.getChangeAddress?.(),
    () => api.getAccount?.(),
    () => api.account?.(),
    () => api.state?.(),
    () => api.getState?.(),
  ];

  // Try priority candidates in parallel with 1500ms timeout
  const results = await Promise.all(
    priorityCandidates.map((fn) =>
      resolveValue(fn, 1500)
        .then((res) => {
          if (!res) return '';
          const addr = extractAddr(res);
          return addr && isValidMidnightAddress(addr) ? addr : '';
        })
        .catch(() => '')
    )
  );

  const matched = results.find((a) => a && isValidMidnightAddress(a));
  if (matched) return matched;

  return '';
}

export function normalizeNetwork(net: string | number | unknown): string {
  if (typeof net === 'number') {
    return String(net);
  }
  const s = String(net || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s === 'prev' || s === 'pr' || s.includes('preview')) return 'preview';
  if (s === 'pre' || s.includes('preprod')) return 'preprod';
  if (s.includes('test')) return 'testnet';
  if (s.includes('main')) return 'mainnet';
  if (s.includes('dev') || s.includes('local') || s.includes('standalone') || s.includes('undeployed') || s.includes('und')) return 'localnet';
  return s;
}

export function detectNetworkFromAddress(address: string): string | null {
  if (!address) return null;
  const clean = address.trim().toLowerCase();

  // 1. Preprod (check first to avoid partial prefix overlap with 'pr')
  if (
    clean.includes('preprod') ||
    clean.includes('_preprod') ||
    clean.includes('_pre1') ||
    clean.startsWith('mn_addr_preprod') ||
    clean.startsWith('mn_shielded_preprod') ||
    clean.startsWith('mn_unshielded_preprod') ||
    clean.startsWith('mn_dust_preprod') ||
    clean.startsWith('mn_addr_pre1') ||
    clean.startsWith('mn_shielded_pre1') ||
    clean.startsWith('mn_unshielded_pre1') ||
    /^mn(?:_[a-z0-9]+)?_(?:preprod|pre)1/.test(clean)
  ) {
    return 'preprod';
  }

  // 2. Preview
  if (
    clean.includes('preview') ||
    clean.includes('_preview') ||
    clean.includes('_pr1') ||
    clean.startsWith('mn_addr_preview') ||
    clean.startsWith('mn_shielded_preview') ||
    clean.startsWith('mn_unshielded_preview') ||
    clean.startsWith('mn_dust_preview') ||
    clean.startsWith('mn_addr_pr1') ||
    clean.startsWith('mn_shielded_pr1') ||
    clean.startsWith('mn_unshielded_pr1') ||
    /^mn(?:_[a-z0-9]+)?_(?:preview|pr)1/.test(clean)
  ) {
    return 'preview';
  }

  // 3. Testnet
  if (
    clean.includes('testnet') ||
    clean.includes('_test1') ||
    clean.startsWith('mn_addr_test') ||
    clean.startsWith('mn_shielded_test') ||
    clean.startsWith('mn_unshielded_test') ||
    /^mn(?:_[a-z0-9]+)?_test1/.test(clean)
  ) {
    return 'testnet';
  }

  // 4. Local / Undeployed
  if (
    clean.includes('undeployed') ||
    clean.includes('local') ||
    clean.includes('_und1') ||
    clean.includes('_dev1') ||
    clean.startsWith('mn_addr_und') ||
    clean.startsWith('mn_addr_dev') ||
    clean.startsWith('mn_shielded_und') ||
    clean.startsWith('mn_shielded_dev')
  ) {
    return 'localnet';
  }

  // 5. Mainnet (no network discriminator in Bech32 prefix, e.g. mn_addr1...)
  if (
    clean.includes('mainnet') ||
    clean.startsWith('mn_addr1') ||
    clean.startsWith('mn_shielded1') ||
    clean.startsWith('mn_unshielded1')
  ) {
    return 'mainnet';
  }

  return null;
}

// Dynamically determine the active network from the wallet API or address format
async function extractWalletNetwork(api: any, address: string): Promise<string> {
  // Query API first if available, as wallet connector has explicit network configuration
  if (api) {
    try {
      const config = await resolveValue(() => api.getConfiguration?.());
      if (config?.networkId) return normalizeNetwork(config.networkId);
    } catch { }
    try {
      const status = await resolveValue(() => api.getConnectionStatus?.());
      if (status?.networkId) return normalizeNetwork(status.networkId);
    } catch { }
    try {
      const net = await resolveValue(() => api.getNetworkId?.());
      if (net !== undefined && net !== null) return normalizeNetwork(net);
    } catch { }
  }

  // Fallback to address HRP discriminator inspection
  const addrNet = detectNetworkFromAddress(address);
  if (addrNet) return addrNet;

  return TARGET_NETWORK;
}

// Fetch balance from the wallet extension
async function fetchWalletBalance(api: any): Promise<{ formatted: string; raw: number }> {
  if (!api) return { formatted: '0.0 tNIGHT', raw: 0 };

  const parseValue = (val: unknown): number | null => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'bigint') return Number(val / 1_000_000n);
    if (typeof val === 'number' && !isNaN(val)) return val > 1_000_000 ? Math.round(val / 1_000_000) : val;
    if (typeof val === 'string') {
      try {
        const big = BigInt(val);
        return Number(big / 1_000_000n);
      } catch {
        const num = parseFloat(val);
        return isNaN(num) ? null : num;
      }
    }
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      for (const k of Object.keys(obj)) {
        const res = parseValue(obj[k]);
        if (res !== null && res > 0) return res;
      }
    }
    return null;
  };

  const methods = [
    () => api.getUnshieldedBalances?.(),
    () => api.getShieldedBalances?.(),
    () => api.getDustBalance?.(),
    () => api.getBalance?.(),
    () => api.getUnshieldedBalance?.(),
    () => api.state?.(),
    () => api.state,
    () => api.getState?.(),
    () => api.account?.balance,
    () => api.account,
    () => api.wallet?.getBalance?.(),
  ];

  for (const method of methods) {
    try {
      const raw = await resolveValue(method);
      const num = parseValue(raw);
      if (num !== null && num >= 0) {
        return { formatted: `${num.toLocaleString()} tNIGHT`, raw: num };
      }
    } catch { }
  }

  return { formatted: '0.0 tNIGHT', raw: 0 };
}

/**
 * Minimal read-only API surface returned when the wallet address is known from
 * localStorage but the browser extension hasn't re-injected yet after a page
 * reload.
 */
function createFallbackWalletApi(address: string, name: string) {
  return {
    name,
    getNetworkId: async () => TARGET_NETWORK,
    getUnshieldedAddress: async () => address,
    getAddress: async () => address,
    getBalance: async () => '0',
    getUnshieldedBalances: async () => ({ '00': 0n }),
  };
}

// Discovery for 1AM Wallet
function get1amConnectorInfo(): { connector: any; icon?: string; name: string } | null {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  const midnight = win.midnight;
  if (midnight && typeof midnight === 'object') {
    if (midnight['1am']) {
      return { connector: midnight['1am'], icon: midnight['1am'].icon, name: '1AM Wallet' };
    }
    if (midnight.oneAm) {
      return { connector: midnight.oneAm, icon: midnight.oneAm.icon, name: '1AM Wallet' };
    }
    if (midnight.one_am) {
      return { connector: midnight.one_am, icon: midnight.one_am.icon, name: '1AM Wallet' };
    }
    for (const [key, connector] of Object.entries(midnight) as [string, any][]) {
      if (connector && typeof connector === 'object') {
        if (
          connector.rdns === 'com.midnight.1am' ||
          connector.rdns === 'xyz.1am' ||
          connector.name?.toLowerCase().includes('1am') ||
          key.toLowerCase().includes('1am')
        ) {
          return { connector, icon: connector.icon, name: '1AM Wallet' };
        }
      }
    }
  }
  if (win.oneAm) return { connector: win.oneAm, icon: win.oneAm.icon, name: '1AM Wallet' };
  if (win.oneAM) return { connector: win.oneAM, icon: win.oneAM.icon, name: '1AM Wallet' };
  return null;
}

// Discovery for Lace Wallet
function getLaceConnectorInfo(): { connector: any; icon?: string; name: string } | null {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  const midnight = win.midnight;
  if (midnight && typeof midnight === 'object') {
    if (midnight.mnLace) {
      return { connector: midnight.mnLace, icon: midnight.mnLace.icon, name: 'Lace' };
    }
    if (midnight.lace) {
      return { connector: midnight.lace, icon: midnight.lace.icon, name: 'Lace' };
    }
    for (const [key, connector] of Object.entries(midnight) as [string, any][]) {
      if (connector && typeof connector === 'object') {
        if (
          connector.rdns === 'io.lace.midnight' ||
          connector.name?.toLowerCase().includes('lace') ||
          key.toLowerCase().includes('lace') ||
          key === 'mnLace'
        ) {
          return { connector, icon: connector.icon, name: 'Lace' };
        }
      }
    }
  }
  if (win.mnLace) return { connector: win.mnLace, icon: win.mnLace.icon, name: 'Lace' };
  if (win.lace?.midnight) return { connector: win.lace.midnight, icon: win.lace.midnight.icon, name: 'Lace' };
  if (win.cardano?.midnight) return { connector: win.cardano.midnight, icon: win.cardano.midnight.icon, name: 'Lace' };
  if (win.lace) return { connector: win.lace, icon: win.lace.icon, name: 'Lace' };
  return null;
}

export function useMidnight(): MidnightHook {
  const [walletState, setWalletState] = useState<WalletState>({ status: 'idle' });
  const [isLaceAvailable, setIsLaceAvailable] = useState(false);
  const [is1amAvailable, setIs1amAvailable] = useState(false);
  const [laceIcon, setLaceIcon] = useState<string | undefined>(undefined);
  const [oneAmIcon, setOneAmIcon] = useState<string | undefined>(undefined);
  const [switchNotification, setSwitchNotification] = useState<string | null>(null);
  const apiRef = useRef<any>(null);

  // Detect injected Midnight extensions
  useEffect(() => {
    const detect = () => {
      const info1am = get1amConnectorInfo();
      const infoLace = getLaceConnectorInfo();

      setIs1amAvailable(!!info1am);
      setIsLaceAvailable(!!infoLace);

      if (info1am?.icon) setOneAmIcon(info1am.icon);
      if (infoLace?.icon) setLaceIcon(infoLace.icon);
    };

    detect();
    const timers = WALLET_DETECT_DELAYS.map((ms) => setTimeout(detect, ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const [lastAttemptedWallet, setLastAttemptedWallet] = useState<WalletType | null>(null);
  const walletStateRef = useRef(walletState);
  walletStateRef.current = walletState;
  const userDisconnectedRef = useRef(false);
  const hasAutoConnectedRef = useRef(false);

  const clearSwitchNotification = useCallback(() => {
    setSwitchNotification(null);
  }, []);

  const connect = useCallback(
    async (type: WalletType = '1am', isAutoConnect = false): Promise<boolean> => {
      if (isAutoConnect && userDisconnectedRef.current) {
        return false;
      }
      if (!isAutoConnect) {
        userDisconnectedRef.current = false;
      }

      setLastAttemptedWallet(type);
      const info = type === '1am' ? get1amConnectorInfo() : getLaceConnectorInfo();
      const walletLabel = type === '1am' ? '1AM Wallet' : 'Lace';
      const isCurrentlyConnected = walletStateRef.current.status === 'connected';

      // If switching wallet while already connected, perform non-destructive switch:
      if (isCurrentlyConnected) {
        if (!info?.connector) {
          setSwitchNotification(
            `${walletLabel} extension was not found in your browser. Please install ${walletLabel} to switch.`
          );
          return false;
        }
      } else if (!isAutoConnect) {
        setWalletState({ status: 'connecting' });
      }

      try {
        let api: any = null;
        if (info?.connector) {
          api = await tryConnect(info.connector, TARGET_NETWORK);
        }

        const realAddr = await getWalletAddressFromApi(api);

        if (!api || !realAddr || !isValidMidnightAddress(realAddr)) {
          if (isAutoConnect) {
            setWalletState({ status: 'idle' });
            return false;
          }

          const isInstalled = !!info?.connector;
          const errorMsg = isInstalled
            ? `Please unlock ${walletLabel} in your browser extension to connect.`
            : `${walletLabel} extension was not found. Please install or enable ${walletLabel} in your browser.`;

          if (isCurrentlyConnected) {
            setSwitchNotification(
              isInstalled
                ? `Please unlock ${walletLabel} in your browser extension to complete the switch.`
                : errorMsg
            );
            return false;
          } else {
            setWalletState({ status: 'error', message: errorMsg });
            return false;
          }
        }

        // Success: extract active network & balance
        const activeNetwork = await extractWalletNetwork(api, realAddr);
        const normActive = normalizeNetwork(activeNetwork);
        const normTarget = normalizeNetwork(TARGET_NETWORK);
        const isMismatch = !!(normActive && normTarget && normActive !== normTarget);

        if (isMismatch) {
          setSwitchNotification(
            `Network Warning: ${walletLabel} is currently set to "${activeNetwork.toUpperCase()}", but Nocturne DEX targets "${TARGET_NETWORK.toUpperCase()}". Please switch network in your wallet settings.`
          );
        } else {
          setSwitchNotification(null);
        }

        try {
          localStorage.setItem(type === '1am' ? ONEAM_ADDRESS_KEY : LACE_ADDRESS_KEY, realAddr);
          localStorage.setItem(LAST_WALLET_KEY, type);
        } catch { }

        const walletApi = api || createFallbackWalletApi(realAddr, walletLabel);
        const { formatted, raw } = await fetchWalletBalance(walletApi);
        apiRef.current = walletApi;

        // Clean up legacy synthetic balances if any
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith('nocturne_balance_'))
            .forEach((k) => localStorage.removeItem(k));
        } catch { }

        setWalletState({
          status: 'connected',
          address: realAddr,
          balance: formatted,
          rawBalance: raw,
          network: activeNetwork,
          isNetworkMismatch: isMismatch,
          walletType: type,
          connectorName: walletLabel,
          iconUrl: info?.icon,
          api: walletApi,
        });

        return true;
      } catch (err: any) {
        if (isAutoConnect) {
          console.warn(`[useMidnight] Auto-connect silently skipped for ${walletLabel}:`, err);
          setWalletState({ status: 'idle' });
          return false;
        }

        console.error(`[useMidnight] Error connecting to ${walletLabel}:`, err);
        const isInstalled = !!info?.connector;
        const msg = isInstalled
          ? `Please unlock ${walletLabel} in your browser extension to connect.`
          : err?.message || `Failed to connect to ${walletLabel}.`;

        if (isCurrentlyConnected) {
          setSwitchNotification(
            isInstalled
              ? `Please unlock ${walletLabel} in your browser extension to complete the switch.`
              : msg
          );
          return false;
        } else {
          setWalletState({ status: 'error', message: msg });
          return false;
        }
      }
    },
    []
  );

  // Auto-detect and auto-retry on window focus (e.g. when user unlocks extension in browser toolbar)
  useEffect(() => {
    const handleFocus = () => {
      if (userDisconnectedRef.current) return;
      // If we were in an error/locked state and user just refocused the tab after unlocking their wallet
      if (walletState.status === 'error' && lastAttemptedWallet) {
        connect(lastAttemptedWallet, false).catch(() => { });
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [walletState.status, lastAttemptedWallet, connect]);

  // Auto reconnect on page mount (silent) — runs once on mount
  useEffect(() => {
    if (hasAutoConnectedRef.current) return;
    hasAutoConnectedRef.current = true;
    if (userDisconnectedRef.current) return;

    const lastWallet = (localStorage.getItem(LAST_WALLET_KEY) || localStorage.getItem('datavault_last_wallet')) as WalletType | null;
    if (lastWallet && (lastWallet === 'lace' || lastWallet === '1am')) {
      const key = lastWallet === 'lace' ? LACE_ADDRESS_KEY : ONEAM_ADDRESS_KEY;
      const legacyKey = lastWallet === 'lace' ? 'datavault_lace_address' : 'datavault_1am_address';
      const storedAddr = localStorage.getItem(key) || localStorage.getItem(legacyKey);
      if (storedAddr && !isValidMidnightAddress(storedAddr)) {
        // Clear invalid cached identifier/placeholder from previous runs
        localStorage.removeItem(key);
        localStorage.removeItem(legacyKey);
        localStorage.removeItem(LAST_WALLET_KEY);
        localStorage.removeItem('datavault_last_wallet');
      } else if (storedAddr && isValidMidnightAddress(storedAddr)) {
        connect(lastWallet, true).catch((err) => {
          console.warn('[useMidnight] auto-connect skipped:', err);
          setWalletState({ status: 'idle' });
        });
      }
    }
  }, [connect]);

  const disconnect = useCallback(() => {
    userDisconnectedRef.current = true;
    setLastAttemptedWallet(null);

    if (apiRef.current) {
      if (typeof apiRef.current.disconnect === 'function') {
        try { apiRef.current.disconnect(); } catch { }
      }
      if (typeof apiRef.current.disable === 'function') {
        try { apiRef.current.disable(); } catch { }
      }
      apiRef.current = null;
    }

    try {
      localStorage.removeItem(LAST_WALLET_KEY);
      localStorage.removeItem('datavault_last_wallet');
      localStorage.removeItem(ONEAM_ADDRESS_KEY);
      localStorage.removeItem(LACE_ADDRESS_KEY);
      localStorage.removeItem('datavault_1am_address');
      localStorage.removeItem('datavault_lace_address');
    } catch { }

    setSwitchNotification(null);
    setWalletState({ status: 'idle' });
  }, []);

  const clearError = useCallback(() => {
    setSwitchNotification(null);
    setWalletState({ status: 'idle' });
  }, []);

  const deductBalance = useCallback((amount: number, targetAddress?: string) => {
    setWalletState((prev) => {
      const currentAddr = prev.status === 'connected' ? prev.address : null;
      if (prev.status !== 'connected') return prev;
      if (targetAddress && targetAddress.trim().toLowerCase() !== currentAddr?.trim().toLowerCase()) return prev;

      const currentRaw = prev.rawBalance ?? 5000;
      const newRaw = Math.max(0, currentRaw - amount);
      const newFormatted = `${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(newRaw)} tNIGHT`;

      return {
        ...prev,
        rawBalance: newRaw,
        balance: newFormatted,
      };
    });
  }, []);

  const creditBalance = useCallback((amount: number, targetAddress?: string) => {
    setWalletState((prev) => {
      const currentAddr = prev.status === 'connected' ? prev.address : null;
      if (prev.status !== 'connected') return prev;
      if (targetAddress && targetAddress.trim().toLowerCase() !== currentAddr?.trim().toLowerCase()) return prev;

      const currentRaw = prev.rawBalance ?? 5000;
      const newRaw = currentRaw + amount;
      const newFormatted = `${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(newRaw)} tNIGHT`;

      return {
        ...prev,
        rawBalance: newRaw,
        balance: newFormatted,
      };
    });
  }, []);

  const walletStatus = walletState.status;
  const refreshBalance = useCallback(async () => {
    if (apiRef.current && walletStatus === 'connected') {
      try {
        const { formatted, raw } = await fetchWalletBalance(apiRef.current);
        const currentNetwork =
          walletState.status === 'connected'
            ? await extractWalletNetwork(apiRef.current, walletState.address)
            : TARGET_NETWORK;
        const normActive = normalizeNetwork(currentNetwork);
        const normTarget = normalizeNetwork(TARGET_NETWORK);
        const isMismatch = !!(normActive && normTarget && normActive !== normTarget);

        setWalletState((prev) => {
          if (prev.status !== 'connected') return prev;
          return {
            ...prev,
            rawBalance: raw,
            balance: formatted,
            network: currentNetwork,
            isNetworkMismatch: isMismatch,
          };
        });
      } catch (err) {
        console.warn('[useMidnight] refreshBalance error:', err);
      }
    }
  }, [walletStatus, walletState]);

  const signAndSubmitPurchaseTx = useCallback(
    async (recipientAddress: string, amountNight: number, _datasetName: string) => {
      if (walletState.status !== 'connected' || !walletState.address) {
        throw new Error('Wallet not connected');
      }

      const api = apiRef.current;
      if (!api) {
        throw new Error('Wallet connector API is not available. Please reconnect your wallet.');
      }

      // Network validation guard for both 1AM and Lace
      const currentNetwork = await extractWalletNetwork(api, walletState.address);
      const normalizedCurrent = normalizeNetwork(currentNetwork);
      const normalizedTarget = normalizeNetwork(TARGET_NETWORK);

      if (normalizedCurrent && normalizedTarget && normalizedCurrent !== normalizedTarget) {
        throw new Error(
          `Network Mismatch: Your wallet is connected to "${currentNetwork.toUpperCase()}", but Nocturne DEX is targeting "${TARGET_NETWORK.toUpperCase()}". ` +
          `Please switch your network in ${walletState.connectorName} settings to ${TARGET_NETWORK.toUpperCase()} before purchasing.`
        );
      }

      const trimmedRecipient = (recipientAddress || '').trim();
      if (!trimmedRecipient) {
        throw new Error('Recipient address is missing for this dataset listing.');
      }

      // If the seller address is an identity commitment hash (0x...) rather than a transfer address
      if (trimmedRecipient.startsWith('0x') && trimmedRecipient.length <= 66) {
        throw new Error(
          `Cannot transfer to provider identity commitment (${trimmedRecipient.slice(0, 10)}...). ` +
          `The seller must provide a valid Midnight transfer address (e.g. mn_addr...).`
        );
      }

      let txHash = '';
      let promptShown = false;
      let lastTransferError: Error | null = null;

      // 1. Midnight DApp Connector v4: makeTransfer
      if (typeof api.makeTransfer === 'function') {
        const microUnits = BigInt(Math.max(1, Math.round(amountNight * 1_000_000)));
        let res: any = null;

        const nativeTokenType = '0000000000000000000000000000000000000000000000000000000000000000';
        const is1am = walletState.walletType === '1am' || (api && (api.is1am || api.name?.toLowerCase().includes('1am')));

        // 1AM wallet strictly requires: recipient (string), type (string), value (string | number), kind ('unshielded' | 'shielded')
        // Lace / Midnight standard connector uses: recipient, type, tokenType, value, kind
        const transferPayload: any[] = [
          {
            kind: 'unshielded',
            type: nativeTokenType,
            tokenType: nativeTokenType,
            value: is1am ? microUnits.toString() : microUnits,
            recipient: trimmedRecipient,
          },
        ];

        try {
          res = await withTimeout<any>(
            api.makeTransfer(transferPayload),
            180000,
            null
          );
        } catch (innerErr: any) {
          const msg = (innerErr?.message || '').toLowerCase();
          if (msg.includes('reject') || msg.includes('cancel') || msg.includes('denied') || innerErr?.code === 4001) {
            throw new Error('Transaction was cancelled in your wallet extension.');
          }
          if (msg.includes('duplicate request') || msg.includes('already pending')) {
            throw new Error('A transfer request is already pending in your 1AM wallet. Please click on "MAKE TRANSFER" under TRANSACTIONS in your wallet extension to approve or cancel it.');
          }
          lastTransferError = innerErr instanceof Error ? innerErr : new Error(String(innerErr?.message || innerErr));

          // Retry with alternate value representation (string vs bigint)
          try {
            const alternatePayload: any[] = [
              {
                kind: 'unshielded',
                type: nativeTokenType,
                tokenType: nativeTokenType,
                value: is1am ? microUnits : microUnits.toString(),
                recipient: trimmedRecipient,
              },
            ];
            res = await withTimeout<any>(
              api.makeTransfer(alternatePayload),
              180000,
              null
            );
            lastTransferError = null;
          } catch (retryErr: any) {
            const retryMsg = (retryErr?.message || '').toLowerCase();
            if (retryMsg.includes('reject') || retryMsg.includes('cancel') || retryMsg.includes('denied') || retryErr?.code === 4001) {
              throw new Error('Transaction was cancelled in your wallet extension.');
            }
            if (retryMsg.includes('duplicate request') || retryMsg.includes('already pending')) {
              throw new Error('A transfer request is already pending in your 1AM wallet. Please click on "MAKE TRANSFER" under TRANSACTIONS in your wallet extension to approve or cancel it.');
            }
            lastTransferError = retryErr instanceof Error ? retryErr : new Error(String(retryErr?.message || retryErr));
            console.error('[useMidnight] makeTransfer failed:', retryErr);
          }
        }

        if (res) {
          promptShown = true;
          const candidate =
            typeof res === 'string'
              ? res
              : res.txHash || res.txId || res.hash || res.id || res.transactionHash || (typeof res.tx === 'string' ? res.tx : '');

          // Submit transaction if wallet returns a prepared / balanced tx that needs submission
          const txToSubmit = (res && typeof res === 'object') ? (res.tx || res.transaction || res) : res;
          if (txToSubmit && typeof api.submitTransaction === 'function') {
            try {
              const submitRes = await api.submitTransaction(txToSubmit);
              if (submitRes) {
                const subCandidate =
                  typeof submitRes === 'string'
                    ? submitRes
                    : submitRes.txHash || submitRes.txId || submitRes.hash || submitRes.id || submitRes.transactionHash;
                if (subCandidate) {
                  txHash = subCandidate;
                }
              }
            } catch (subErr: any) {
              console.error('[useMidnight] submitTransaction failed:', subErr);
              throw new Error(`Transaction submission to Midnight network failed: ${subErr?.message || subErr}`);
            }
          }

          if (!txHash && candidate) {
            txHash = candidate;
          }
        } else if (lastTransferError) {
          throw new Error(`Wallet transaction failed: ${lastTransferError.message}`);
        }
      }

      // 2. Legacy / alternate transfer methods (only if makeTransfer was not available)
      if (!txHash && typeof api.makeTransfer !== 'function') {
        const transferMethods = [
          () => api.transfer?.({ to: trimmedRecipient, recipient: trimmedRecipient, amount: amountNight, coinType: 'tNIGHT' }),
          () => api.sendTransaction?.({ to: trimmedRecipient, recipient: trimmedRecipient, amount: amountNight, currency: 'tNIGHT' }),
          () => api.send?.({ to: trimmedRecipient, amount: amountNight }),
          () => api.transferTokens?.(trimmedRecipient, amountNight),
        ];

        for (const fn of transferMethods) {
          try {
            const maybePromise = fn();
            if (maybePromise && typeof maybePromise.then === 'function') {
              const res: any = await withTimeout<any>(maybePromise, 30000, null);
              if (res) {
                promptShown = true;
                if (typeof res === 'string') txHash = res;
                else if (res.txId || res.txHash || res.id || res.hash) txHash = res.txId || res.txHash || res.id || res.hash;
                break;
              }
            }
          } catch (e: any) {
            const msg = (e?.message || '').toLowerCase();
            if (msg.includes('reject') || msg.includes('cancel') || msg.includes('denied') || e?.code === 4001) {
              throw new Error('Transaction was cancelled in your wallet extension.');
            }
            throw new Error(`Transfer failed: ${e?.message || e}`);
          }
        }
      }

      // Reject non-transfer fallback: message signing (signData) is NOT a payment
      if (!txHash) {
        throw new Error(
          'On-chain tNIGHT transfer was not completed by your wallet extension. ' +
          'Please ensure your wallet has sufficient tNIGHT, active DUST status, and that the transaction was confirmed.'
        );
      }

      // Refresh balance after successful transfer
      try {
        await refreshBalance();
      } catch {}

      return {
        success: true,
        txHash,
        promptShown,
      };
    },
    [walletState, refreshBalance]
  );

  const isNetworkMismatch =
    walletState.status === 'connected' &&
    !!(
      normalizeNetwork(walletState.network) &&
      normalizeNetwork(TARGET_NETWORK) &&
      normalizeNetwork(walletState.network) !== normalizeNetwork(TARGET_NETWORK)
    );

  return {
    walletState,
    connect,
    disconnect,
    clearError,
    targetNetwork: TARGET_NETWORK,
    isNetworkMismatch,
    isLaceAvailable,
    is1amAvailable,
    laceIcon,
    oneAmIcon,
    switchNotification,
    clearSwitchNotification,
    deductBalance,
    creditBalance,
    refreshBalance,
    signAndSubmitPurchaseTx,
  };
}
