// useUserProfile.ts
// Per-wallet profile, purchases, sales, and transaction storage — keyed by wallet address in localStorage.
//
// ─── Privacy Note ────────────────────────────────────────────────────────────
// Profile and purchase metadata are stored locally in browser storage keyed by wallet address.
// Zero-knowledge settlement receipts verify acquired dataset ownership.
// ────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';

export interface UserProfile {
  nickname: string;
  avatarId: string;
  bio: string;
}

export type TransactionType = 'registered' | 'verified' | 'purchased' | 'sold';

export type TransactionStatus = 'completed' | 'pending';

export interface UserTransaction {
  id: string;
  date: string;           // ISO string
  datasetName: string;
  datasetId: string;
  type: TransactionType;
  price?: string;
  txId?: string;          // on-chain transaction ID if available
  status: TransactionStatus;
}

export interface PurchaseRecord {
  id: string;
  datasetId: string;
  datasetName: string;
  price: string;
  currency: string;
  purchaseDate: string;   // ISO string
  receiptHash: string;    // Cryptographic transaction hash
  dataCommitment: string; // On-chain ZK integrity anchor
  sellerCommit: string;
  downloadPayload?: string; // File payload for instant re-download
  format?: string;        // 'csv' | 'json'
  license?: string;
  rowCount?: string;
  datasetSize?: string;
}

export interface SaleRecord {
  id: string;
  datasetId: string;
  datasetName: string;
  price: string;
  currency: string;
  saleDate: string;
  buyerCommit: string;
  txHash: string;
}

export interface UserProfileHook {
  profile: UserProfile;
  transactions: UserTransaction[];
  purchases: PurchaseRecord[];
  sales: SaleRecord[];
  updateProfile: (partial: Partial<UserProfile>) => void;
  addTransaction: (tx: UserTransaction) => void;
  addPurchase: (purchase: PurchaseRecord) => void;
  removePurchase: (purchaseId: string) => void;
  addSale: (sale: SaleRecord) => void;
  isPurchased: (datasetId: string) => boolean;
  clearProfile: () => void;
}

const DEFAULT_PROFILE: UserProfile = {
  nickname: '',
  avatarId: 'shield',
  bio: '',
};

function profileKey(address: string): string {
  return `nocturne_profile_${address}`;
}

function legacyProfileKey(address: string): string {
  return `datavault_profile_${address}`;
}

function txKey(address: string): string {
  return `nocturne_txns_${address}`;
}

function legacyTxKey(address: string): string {
  return `datavault_txns_${address}`;
}

function purchasesKey(address: string): string {
  return `nocturne_purchases_${address}`;
}

function salesKey(address: string): string {
  return `nocturne_sales_${address}`;
}

function loadProfile(address: string): UserProfile {
  try {
    const raw = localStorage.getItem(profileKey(address)) || localStorage.getItem(legacyProfileKey(address));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        let avatar = parsed.avatarId || parsed.avatarEmoji || DEFAULT_PROFILE.avatarId;
        if (typeof avatar === 'string' && avatar.length > 0 && /[\u{1F300}-\u{1F9FF}]/u.test(avatar)) {
          avatar = 'shield';
        }
        return {
          nickname: parsed.nickname ?? DEFAULT_PROFILE.nickname,
          avatarId: avatar || DEFAULT_PROFILE.avatarId,
          bio: parsed.bio ?? DEFAULT_PROFILE.bio,
        };
      }
    }
  } catch {}
  return { ...DEFAULT_PROFILE };
}

function saveProfile(address: string, profile: UserProfile): void {
  try {
    localStorage.setItem(profileKey(address), JSON.stringify(profile));
  } catch {}
}

function loadTransactions(address: string): UserTransaction[] {
  try {
    const raw = localStorage.getItem(txKey(address)) || localStorage.getItem(legacyTxKey(address));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveTransactions(address: string, txns: UserTransaction[]): void {
  try {
    localStorage.setItem(txKey(address), JSON.stringify(txns));
  } catch {}
}

function loadPurchases(address: string): PurchaseRecord[] {
  try {
    const raw = localStorage.getItem(purchasesKey(address));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function savePurchases(address: string, purchases: PurchaseRecord[]): void {
  try {
    localStorage.setItem(purchasesKey(address), JSON.stringify(purchases));
  } catch {}
}

function loadSales(address: string): SaleRecord[] {
  try {
    const raw = localStorage.getItem(salesKey(address));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveSales(address: string, sales: SaleRecord[]): void {
  try {
    localStorage.setItem(salesKey(address), JSON.stringify(sales));
  } catch {}
}

export function useUserProfile(walletAddress: string | null): UserProfileHook {
  const [profile, setProfile] = useState<UserProfile>(() =>
    walletAddress ? loadProfile(walletAddress) : { ...DEFAULT_PROFILE },
  );
  const [transactions, setTransactions] = useState<UserTransaction[]>(() =>
    walletAddress ? loadTransactions(walletAddress) : [],
  );
  const [purchases, setPurchases] = useState<PurchaseRecord[]>(() =>
    walletAddress ? loadPurchases(walletAddress) : [],
  );
  const [sales, setSales] = useState<SaleRecord[]>(() =>
    walletAddress ? loadSales(walletAddress) : [],
  );

  // Reload when wallet address changes (e.g. user switches accounts)
  useEffect(() => {
    if (walletAddress) {
      setProfile(loadProfile(walletAddress));
      setTransactions(loadTransactions(walletAddress));
      setPurchases(loadPurchases(walletAddress));
      setSales(loadSales(walletAddress));
    } else {
      setProfile({ ...DEFAULT_PROFILE });
      setTransactions([]);
      setPurchases([]);
      setSales([]);
    }
  }, [walletAddress]);

  const updateProfile = useCallback(
    (partial: Partial<UserProfile>) => {
      if (!walletAddress) return;
      setProfile((prev) => {
        const updated = { ...prev, ...partial };
        saveProfile(walletAddress, updated);
        return updated;
      });
    },
    [walletAddress],
  );

  const addTransaction = useCallback(
    (tx: UserTransaction) => {
      if (!walletAddress) return;
      setTransactions((prev) => {
        const updated = [tx, ...prev];
        saveTransactions(walletAddress, updated);
        return updated;
      });
    },
    [walletAddress],
  );

  const addPurchase = useCallback(
    (purchase: PurchaseRecord) => {
      if (!walletAddress) return;
      setPurchases((prev) => {
        const filtered = prev.filter((p) => p.datasetId !== purchase.datasetId);
        const updated = [purchase, ...filtered];
        savePurchases(walletAddress, updated);
        return updated;
      });
    },
    [walletAddress],
  );

  const removePurchase = useCallback(
    (purchaseId: string) => {
      if (!walletAddress) return;
      setPurchases((prev) => {
        const cleanTarget = purchaseId.startsWith('0x') ? purchaseId.slice(2) : purchaseId;
        const updated = prev.filter(
          (p) =>
            p.id !== purchaseId &&
            p.datasetId !== purchaseId &&
            p.datasetId !== cleanTarget &&
            (p.datasetId.startsWith('0x') ? p.datasetId.slice(2) : p.datasetId) !== cleanTarget,
        );
        savePurchases(walletAddress, updated);
        return updated;
      });
    },
    [walletAddress],
  );

  const addSale = useCallback(
    (sale: SaleRecord) => {
      if (!walletAddress) return;
      setSales((prev) => {
        const updated = [sale, ...prev];
        saveSales(walletAddress, updated);
        return updated;
      });
    },
    [walletAddress],
  );

  const isPurchased = useCallback(
    (datasetId: string): boolean => {
      if (!datasetId) return false;
      const cleanId = datasetId.startsWith('0x') ? datasetId.slice(2) : datasetId;
      return purchases.some(
        (p) =>
          p.datasetId === cleanId ||
          (p.datasetId.startsWith('0x') ? p.datasetId.slice(2) : p.datasetId) === cleanId,
      );
    },
    [purchases],
  );

  const clearProfile = useCallback(() => {
    if (!walletAddress) return;
    const fresh = { ...DEFAULT_PROFILE };
    saveProfile(walletAddress, fresh);
    saveTransactions(walletAddress, []);
    savePurchases(walletAddress, []);
    saveSales(walletAddress, []);
    setProfile(fresh);
    setTransactions([]);
    setPurchases([]);
    setSales([]);
  }, [walletAddress]);

  return {
    profile,
    transactions,
    purchases,
    sales,
    updateProfile,
    addTransaction,
    addPurchase,
    removePurchase,
    addSale,
    isPurchased,
    clearProfile,
  };
}
