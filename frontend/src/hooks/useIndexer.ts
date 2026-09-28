// useIndexer.ts
// Live GraphQL indexer queries for Midnight on-chain ledger state.
// Reads strictly public ledger state without mock or pre-seeded dummy data.

import { useState, useEffect, useCallback } from 'react';
import {
  INDEXER_URL,
  CONTRACT_ADDRESS,
  INDEXER_POLL_MS,
  INDEXER_FETCH_TIMEOUT_MS,
} from '../config';

export interface DataListing {
  datasetId: string;         // 32-byte hex ID
  providerCommit: string;    // hash of provider secret key
  dataCommitment: string;    // 32-byte SHA256 integrity anchor
  datasetName: string;       // public descriptive title
  datasetSize: string;       // byte size string
  rowCount: string;          // row count representation
  license: string;           // license identifier
  isActive: boolean;         // listing availability
  category?: string;         // taxonomy tag
  description?: string;      // metadata description
  complianceTag?: string;    // compliance standard
  price?: string;            // e.g. "35", "0"
  currency?: string;         // "tDUST"
  sellerAddress?: string;    // Provider address
  sellerNickname?: string;   // Provider display nickname
  accessTier?: 'free' | 'paid' | 'commercial';
  sampleData?: string;       // Privacy-safe sample preview
  downloadPayload?: string;  // Complete payload for buyers upon acquisition
  format?: string;           // 'csv' | 'json' | 'parquet'
  verifiedOnChain?: boolean; // Pre-purchase verification indicator
}

export interface RegistryState {
  verifiedCount: number;
  listings: DataListing[];
  lastSyncedAt: Date;
}

const LOCAL_STORAGE_KEY = 'nocturne_registered_datasets';
const VERIFIED_STORAGE_KEY = 'nocturne_verified_count';

function getLocalListings(): DataListing[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveLocalListings(listings: DataListing[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(listings));
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      try {
        // Strip large payloads to preserve listing metadata under 5MB localStorage quota
        const pruned = listings.map((l) => ({
          ...l,
          downloadPayload: l.downloadPayload && l.downloadPayload.length > 10000 ? '[Stored on provider node]' : l.downloadPayload,
        }));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pruned));
      } catch {}
    }
  }
}

const STATE_QUERY = `
  query ContractState($address: String!) {
    contract(address: $address) {
      state {
        ledger {
          verifiedCount
          registry {
            entries {
              key
              value {
                providerCommit
                dataCommitment
                datasetName
                category
                datasetSize
                rowCount
                license
                isActive
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchRegistryState(): Promise<{ verifiedCount: number; listings: DataListing[] } | null> {
  if (!CONTRACT_ADDRESS) return null;

  try {
    const resp = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: STATE_QUERY, variables: { address: CONTRACT_ADDRESS } }),
      signal: AbortSignal.timeout(INDEXER_FETCH_TIMEOUT_MS),
    });

    if (!resp.ok) return null;
    const json: any = await resp.json();

    const ledger = json?.data?.contract?.state?.ledger;
    if (!ledger) return null;

    const entries: any[] = ledger?.registry?.entries ?? [];
    const listings: DataListing[] = entries.map((e: any) => ({
      datasetId: e.key ?? '',
      providerCommit: e.value?.providerCommit ?? '',
      dataCommitment: e.value?.dataCommitment ?? '',
      datasetName: e.value?.datasetName ?? 'Registered Dataset',
      datasetSize: e.value?.datasetSize ?? '0',
      rowCount: e.value?.rowCount ?? '0',
      license: e.value?.license ?? 'CC-BY-4.0',
      isActive: e.value?.isActive ?? false,
      category: e.value?.category ?? 'General AI',
      complianceTag: e.value?.complianceTag ?? null,
      price: e.value?.price ?? '0',
      currency: 'tNIGHT',
      accessTier: e.value?.price && e.value?.price !== '0' ? 'paid' : 'free',
      verifiedOnChain: true,
    }));

    return {
      verifiedCount: Number(ledger?.verifiedCount ?? 0),
      listings: listings.filter((l) => l.isActive),
    };
  } catch {
    return null;
  }
}

export interface IndexerHook {
  state: RegistryState;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  contractConfigured: boolean;
  contractAddress: string;
  addOptimisticListing: (listing: DataListing) => void;
  incrementVerifiedCount: () => void;
  toggleArchiveListing: (datasetId: string, callerAddress?: string | null) => boolean;
  removeListing: (datasetId: string, callerAddress?: string | null) => boolean;
}

export function useIndexer(): IndexerHook {
  const [state, setState] = useState<RegistryState>(() => {
    let savedVerified = 0;
    try {
      const v = localStorage.getItem(VERIFIED_STORAGE_KEY);
      if (v && !isNaN(Number(v))) savedVerified = Number(v);
    } catch {}

    return {
      verifiedCount: savedVerified,
      listings: getLocalListings(),
      lastSyncedAt: new Date(),
    };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contractConfigured = !!CONTRACT_ADDRESS;

  const refresh = useCallback(() => {
    if (!CONTRACT_ADDRESS) return;
    setLoading(true);

    fetchRegistryState()
      .then((res) => {
        const local = getLocalListings();
        const onChain = res?.listings ?? [];
        const onChainIds = new Set(onChain.map((l) => l.datasetId));

        // Merge: on-chain items + locally saved user-registered items
        const mergedLocal = local.filter((l) => !onChainIds.has(l.datasetId));
        const finalList = [...onChain, ...mergedLocal];

        let currentVerified = 0;
        try {
          const v = localStorage.getItem(VERIFIED_STORAGE_KEY);
          if (v && !isNaN(Number(v))) currentVerified = Number(v);
        } catch {}

        // M10 fix: Always prefer on-chain verified count. The local value
        // from localStorage can be tampered with via DevTools.
        const finalVerified = res !== null ? (res.verifiedCount ?? 0) : currentVerified;

        setState({
          verifiedCount: finalVerified,
          listings: finalList,
          lastSyncedAt: new Date(),
        });
        setError(null);
      })
      .catch((e: any) => {
        setError(e?.message ?? String(e));
      })
      .finally(() => setLoading(false));
  }, []);

  const addOptimisticListing = useCallback((listing: DataListing) => {
    const cleanId = listing.datasetId.startsWith('0x')
      ? listing.datasetId.slice(2)
      : listing.datasetId;
    const cleanListing = { ...listing, datasetId: cleanId };

    const currentLocal = getLocalListings();
    const updatedLocal = [cleanListing, ...currentLocal.filter((l) => l.datasetId !== cleanId)];
    saveLocalListings(updatedLocal);

    setState((prev) => {
      const rest = prev.listings.filter((l) => l.datasetId !== cleanId);
      return {
        ...prev,
        listings: [cleanListing, ...rest],
        lastSyncedAt: new Date(),
      };
    });
  }, []);

  // ⚠ WARNING (C5): This authorization check is UI-only and runs entirely in
  // the browser. It is trivially bypassable via DevTools. Real authorization
  // must go through the smart contract's setActive / delistDataset circuits
  // which verify the caller's providerCommit against the on-chain record.
  // This client-side check only prevents accidental misuse in the UI.
  const toggleArchiveListing = useCallback((datasetId: string, callerAddress?: string | null): boolean => {
    const cleanId = datasetId.startsWith('0x') ? datasetId.slice(2) : datasetId;
    let authorized = false;

    setState((prev) => {
      const target = prev.listings.find((l) => l.datasetId === cleanId);
      if (!target) return prev;

      if (callerAddress) {
        const cleanCaller = callerAddress.trim().toLowerCase();
        const cleanProvider = (target.providerCommit || '').trim().toLowerCase();
        const cleanSeller = (target.sellerAddress || '').trim().toLowerCase();

        let isTxOwner = false;
        try {
          const rawTxns = localStorage.getItem(`nocturne_txns_${callerAddress}`) || localStorage.getItem(`datavault_txns_${callerAddress}`);
          if (rawTxns) {
            const txns = JSON.parse(rawTxns);
            if (Array.isArray(txns)) {
              isTxOwner = txns.some((t: any) => t.type === 'registered' && (t.datasetId === cleanId || t.datasetId === `0x${cleanId}`));
            }
          }
        } catch {}

        const isAuth =
          cleanSeller.length > 0
            ? cleanSeller === cleanCaller
            : (cleanProvider.length > 0 && cleanProvider === cleanCaller) ||
              (cleanProvider.length > 0 && cleanProvider === cleanCaller.replace(/^mn_addr(?:_[a-z0-9]+)?1/, '')) ||
              (cleanProvider.length > 0 && cleanCaller === cleanProvider.replace(/^mn_addr(?:_[a-z0-9]+)?1/, '')) ||
              isTxOwner;

        if (!isAuth) {
          console.warn('[useIndexer] Unauthorized attempt to archive dataset by', callerAddress);
          return prev;
        }
      } else {
        // Unauthenticated callers cannot archive
        return prev;
      }

      authorized = true;
      const updatedListings = prev.listings.map((l) => {
        if (l.datasetId === cleanId) {
          return {
            ...l,
            isActive: !l.isActive,
            sellerAddress: l.sellerAddress || (callerAddress ?? undefined),
          };
        }
        return l;
      });
      saveLocalListings(updatedListings);
      return {
        ...prev,
        listings: updatedListings,
        lastSyncedAt: new Date(),
      };
    });

    return authorized;
  }, []);

  // ⚠ WARNING (C5): Same client-side-only auth limitation as toggleArchiveListing.
  // Real removal authorization is enforced on-chain by the delistDataset circuit.
  const removeListing = useCallback((datasetId: string, callerAddress?: string | null): boolean => {
    const cleanId = datasetId.startsWith('0x') ? datasetId.slice(2) : datasetId;
    let authorized = false;

    setState((prev) => {
      const target = prev.listings.find((l) => l.datasetId === cleanId);
      if (!target) return prev;

      if (callerAddress) {
        const cleanCaller = callerAddress.trim().toLowerCase();
        const cleanProvider = (target.providerCommit || '').trim().toLowerCase();
        const cleanSeller = (target.sellerAddress || '').trim().toLowerCase();

        let isTxOwner = false;
        try {
          const rawTxns = localStorage.getItem(`nocturne_txns_${callerAddress}`) || localStorage.getItem(`datavault_txns_${callerAddress}`);
          if (rawTxns) {
            const txns = JSON.parse(rawTxns);
            if (Array.isArray(txns)) {
              isTxOwner = txns.some((t: any) => t.type === 'registered' && (t.datasetId === cleanId || t.datasetId === `0x${cleanId}`));
            }
          }
        } catch {}

        const isAuth =
          cleanSeller.length > 0
            ? cleanSeller === cleanCaller
            : (cleanProvider.length > 0 && cleanProvider === cleanCaller) ||
              (cleanProvider.length > 0 && cleanProvider === cleanCaller.replace(/^mn_addr(?:_[a-z0-9]+)?1/, '')) ||
              (cleanProvider.length > 0 && cleanCaller === cleanProvider.replace(/^mn_addr(?:_[a-z0-9]+)?1/, '')) ||
              isTxOwner;

        if (!isAuth) {
          console.warn('[useIndexer] Unauthorized attempt to remove dataset by', callerAddress);
          return prev;
        }
      } else {
        // Unauthenticated callers cannot remove
        return prev;
      }

      authorized = true;
      const updatedListings = prev.listings.filter((l) => l.datasetId !== cleanId);
      saveLocalListings(updatedListings);
      return {
        ...prev,
        listings: updatedListings,
        lastSyncedAt: new Date(),
      };
    });

    return authorized;
  }, []);

  const incrementVerifiedCount = useCallback(() => {
    setState((prev) => {
      const nextCount = prev.verifiedCount + 1;
      try {
        localStorage.setItem(VERIFIED_STORAGE_KEY, String(nextCount));
      } catch {}
      return { ...prev, verifiedCount: nextCount };
    });
  }, []);

  useEffect(() => {
    if (!CONTRACT_ADDRESS) return;
    refresh();
    const timer = setInterval(refresh, INDEXER_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return {
    state,
    loading,
    error,
    refresh,
    contractConfigured,
    contractAddress: CONTRACT_ADDRESS,
    addOptimisticListing,
    incrementVerifiedCount,
    toggleArchiveListing,
    removeListing,
  };
}
