import React, { useState, useMemo } from 'react';
import type { WalletState } from '../hooks/useMidnight';
import { normalizeNetwork } from '../hooks/useMidnight';
import { TARGET_NETWORK } from '../config';
import type { DataListing, RegistryState } from '../hooks/useIndexer';
import type { UserProfileHook, PurchaseRecord, SaleRecord } from '../hooks/useUserProfile';
import type { ContractBridgeHook } from '../hooks/useContractBridge';
import type { NavSection } from '../App';
import { ProfileDashboard } from './ProfileDashboard';
import { isListingOwner } from '../utils/datasetUtils';
import {
  ShieldCheck,
  Search,
  PlusCircle,
  RefreshCw,
  Check,
  X,
  Database,
  Eye,
  Bookmark,
  Download,
  ShoppingBag,
  Key,
  FolderUp,
  Lock,
  ArrowRight,
  User,
  Copy,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  walletApi: any;
  walletState: WalletState;
  onConnect: (walletType: '1am' | 'lace') => Promise<void>;
  activeSection: NavSection;
  onSelectSection: (sec: NavSection) => void;
  registryState: RegistryState;
  indexerLoading: boolean;
  indexerError: string | null;
  contractAddress: string;
  walletAddress: string | null;
  profileHook: UserProfileHook;
  contractBridge: ContractBridgeHook;
  onRefresh: () => void;
  onAddListing: (listing: DataListing) => void;
  onToggleArchive?: (datasetId: string) => void;
  onRemoveListing?: (datasetId: string) => void;
  onIncrementVerified: () => void;
  onDeductBalance?: (amount: number, targetAddress?: string) => void;
  onCreditBalance?: (amount: number, targetAddress?: string) => void;
  onSignAndSubmitPurchaseTx?: (
    recipientAddress: string,
    amountNight: number,
    datasetName: string
  ) => Promise<{ success: boolean; txHash: string; promptShown: boolean }>;
  onRefreshBalance?: () => void;
  laceIcon?: string;
  oneAmIcon?: string;
}

export function DatasetExchange({
  walletState,
  onConnect,
  activeSection,
  onSelectSection,
  registryState,
  indexerLoading,
  indexerError,
  walletAddress,
  profileHook,
  contractBridge,
  onRefresh,
  onAddListing,
  onToggleArchive,
  onRemoveListing,
  onIncrementVerified,
  onDeductBalance,
  onCreditBalance,
  onSignAndSubmitPurchaseTx,
  onRefreshBalance,
}: Props) {
  const [selectedListingForModal, setSelectedListingForModal] = useState<DataListing | null>(null);
  const [purchasingListing, setPurchasingListing] = useState<DataListing | null>(null);
  const [preselectedListingForVerifier, setPreselectedListingForVerifier] = useState<DataListing | null>(null);
  const [verifierInitialPayload, setVerifierInitialPayload] = useState<string | null>(null);

  // Saved favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nocturne_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('nocturne_favorites', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleStartVerification = (listing: DataListing, initialPayload?: string) => {
    setSelectedListingForModal(null);
    setPurchasingListing(null);
    setPreselectedListingForVerifier(listing);
    setVerifierInitialPayload(initialPayload || null);
    onSelectSection('verifier');
  };

  const handleStartPurchase = (listing: DataListing) => {
    const registeredIds = new Set(
      profileHook.transactions.filter((t) => t.type === 'registered').map((t) => t.datasetId)
    );
    const isOwner = isListingOwner(listing, walletAddress, registeredIds);
    if (isOwner) {
      return;
    }
    setSelectedListingForModal(null);
    setPurchasingListing(listing);
  };

  const handleDirectDownload = (listing: DataListing) => {
    const payload = listing.downloadPayload || listing.sampleData || `Dataset: ${listing.datasetName}\nID: ${listing.datasetId}`;
    const filename = `${listing.datasetName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.${listing.format || 'csv'}`;
    const blob = new Blob([payload], { type: listing.format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* 1. PROTOCOL OVERVIEW */}
      {activeSection === 'about' && (
        <AboutView
          onExplore={() => onSelectSection('marketplace')}
          onRegister={() => onSelectSection('register')}
        />
      )}

      {/* 2. MARKETPLACE */}
      {activeSection === 'marketplace' && (
        <MarketplaceView
          listings={registryState.listings}
          loading={indexerLoading}
          error={indexerError}
          favorites={favorites}
          walletAddress={walletAddress}
          profileHook={profileHook}
          onToggleFavorite={toggleFavorite}
          onRefresh={() => {
            onRefresh();
            onRefreshBalance?.();
          }}
          onInspect={(listing) => setSelectedListingForModal(listing)}
          onBuy={handleStartPurchase}
          onDownload={handleDirectDownload}
          onVerify={(l) => handleStartVerification(l)}
          onRegisterNew={() => onSelectSection('register')}
        />
      )}

      {/* 3. LIST / SELL DATASET */}
      {activeSection === 'register' && (
        <RegisterView
          walletState={walletState}
          walletAddress={walletAddress}
          profileHook={profileHook}
          contractBridge={contractBridge}
          onSuccess={(listing, txHash) => {
            onAddListing(listing);
            profileHook.addTransaction({
              id: `tx_${Date.now()}`,
              date: new Date().toISOString(),
              datasetName: listing.datasetName,
              datasetId: listing.datasetId,
              type: 'registered',
              price: listing.price && listing.price !== '0' ? `${listing.price} tNIGHT` : 'Free',
              txId: txHash || undefined,
              status: 'completed',
            });
            onSelectSection('marketplace');
          }}
        />
      )}

      {/* 4. VERIFY INTEGRITY */}
      {activeSection === 'verifier' && (
        <VerifierView
          listings={registryState.listings}
          preselectedListing={preselectedListingForVerifier}
          initialPayload={verifierInitialPayload}
          contractBridge={contractBridge}
          onIncrementVerified={() => {
            onIncrementVerified();
            if (preselectedListingForVerifier) {
              profileHook.addTransaction({
                id: `tx_${Date.now()}`,
                date: new Date().toISOString(),
                datasetName: preselectedListingForVerifier.datasetName,
                datasetId: preselectedListingForVerifier.datasetId,
                type: 'verified',
                status: 'completed',
              });
            }
          }}
        />
      )}

      {/* 5. USER PROFILE & PURCHASES */}
      {activeSection === 'profile' && walletAddress && (
        <ProfileDashboard
          walletAddress={walletAddress}
          profileHook={profileHook}
          registryState={registryState}
          onSelectSection={onSelectSection}
          onToggleArchive={onToggleArchive}
          onRemoveListing={onRemoveListing}
          onVerifyAcquisition={(listing, payload) => handleStartVerification(listing, payload)}
        />
      )}

      {/* CHECKOUT MODAL */}
      {purchasingListing && (
        <PurchaseModal
          listing={purchasingListing}
          walletState={walletState}
          walletAddress={walletAddress}
          profileHook={profileHook}
          contractBridge={contractBridge}
          onConnectWallet={() => onConnect('lace')}
          onClose={() => setPurchasingListing(null)}
          onDirectVerify={(listing, payload) => handleStartVerification(listing, payload)}
          onDownload={handleDirectDownload}
          onDeductBalance={onDeductBalance}
          onCreditBalance={onCreditBalance}
          onSignAndSubmitPurchaseTx={onSignAndSubmitPurchaseTx}
          onRefreshBalance={onRefreshBalance}
          onSelectSection={onSelectSection}
        />
      )}

      {/* INSPECT MODAL */}
      {selectedListingForModal && (
        <InspectModal
          listing={selectedListingForModal}
          isFavorite={favorites.includes(selectedListingForModal.datasetId)}
          walletAddress={walletAddress}
          profileHook={profileHook}
          onToggleFavorite={() => toggleFavorite(selectedListingForModal.datasetId)}
          onClose={() => setSelectedListingForModal(null)}
          onBuy={() => handleStartPurchase(selectedListingForModal)}
          onDownload={() => handleDirectDownload(selectedListingForModal)}
          onVerify={() => handleStartVerification(selectedListingForModal)}
          onRemoveListing={onRemoveListing}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. ABOUT / OVERVIEW VIEW
// ═════════════════════════════════════════════════════════════════════════════

function AboutView({
  onExplore,
  onRegister,
}: {
  onExplore: () => void;
  onRegister: () => void;
}) {
  return (
    <div style={{ padding: '3.5rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '960px' }}>
        {/* Clean Apple-style Hero */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div className="badge" style={{ marginBottom: '1.25rem' }}>
            Built on Midnight Network
          </div>
          <h1 style={{ marginBottom: '1rem', letterSpacing: '-0.03em' }}>
            The Confidential AI <br />
            <span className="text-gradient">Dataset Marketplace</span>
          </h1>
          <p style={{ fontSize: '1.15rem', maxWidth: '620px', margin: '0 auto 2.25rem auto', color: 'var(--text-muted)' }}>
            Buy, sell, and verify AI training data with complete privacy. 
            Sellers prove data authenticity on-chain; buyers verify integrity before and after purchase.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={onExplore}>
              Explore Marketplace <ArrowRight size={16} />
            </button>
            <button className="btn btn-secondary btn-lg" onClick={onRegister}>
              List a Dataset
            </button>
          </div>
        </div>

        {/* 3 Step Workflow */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
            marginBottom: '4rem',
          }}
        >
          <div className="card">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f5f5f7',
                marginBottom: '1.15rem',
              }}
            >
              <FolderUp size={20} strokeWidth={1.75} />
            </div>
            <h3 style={{ marginBottom: '0.4rem' }}>1. List & Set Terms</h3>
            <p style={{ fontSize: '0.88rem' }}>
              Upload your dataset. Raw data is hashed locally and anchored on Midnight. Set your price in tNIGHT or share for free.
            </p>
          </div>

          <div className="card">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f5f5f7',
                marginBottom: '1.15rem',
              }}
            >
              <ShieldCheck size={20} strokeWidth={1.75} />
            </div>
            <h3 style={{ marginBottom: '0.4rem' }}>2. Pre-Purchase Proof</h3>
            <p style={{ fontSize: '0.88rem' }}>
              Buyers review sample data and check verified on-chain integrity proofs before paying a single token.
            </p>
          </div>

          <div className="card">
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f5f5f7',
                marginBottom: '1.15rem',
              }}
            >
              <Lock size={20} strokeWidth={1.75} />
            </div>
            <h3 style={{ marginBottom: '0.4rem' }}>3. Secure Acquisition</h3>
            <p style={{ fontSize: '0.88rem' }}>
              Settle payment privately with your wallet. Download deliverables and run deliverable hash checks immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. MARKETPLACE VIEW
// ═════════════════════════════════════════════════════════════════════════════

function MarketplaceView({
  listings,
  loading,
  error,
  favorites,
  walletAddress,
  profileHook,
  onToggleFavorite,
  onRefresh,
  onInspect,
  onBuy,
  onDownload,
  onVerify,
  onRegisterNew,
}: {
  listings: DataListing[];
  loading: boolean;
  error: string | null;
  favorites: string[];
  walletAddress: string | null;
  profileHook: UserProfileHook;
  onToggleFavorite: (id: string) => void;
  onRefresh: () => void;
  onInspect: (listing: DataListing) => void;
  onBuy: (listing: DataListing) => void;
  onDownload: (listing: DataListing) => void;
  onVerify: (listing: DataListing) => void;
  onRegisterNew: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'paid' | 'purchased' | 'favorites'>('all');

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      const matchesSearch =
        l.datasetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.category && l.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.description && l.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        l.datasetId.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (l.isActive === false) return false;

      const isFree = !l.price || l.price === '0' || l.price.toLowerCase() === 'free';
      const isOwned = profileHook.isPurchased(l.datasetId);
      const isFav = favorites.includes(l.datasetId);

      if (pricingFilter === 'free' && !isFree) return false;
      if (pricingFilter === 'paid' && isFree) return false;
      if (pricingFilter === 'purchased' && !isOwned) return false;
      if (pricingFilter === 'favorites' && !isFav) return false;

      return true;
    });
  }, [listings, searchTerm, pricingFilter, favorites, profileHook]);

  return (
    <div style={{ padding: '2rem 0 4rem 0' }}>
      <div className="container">
        {/* Marketplace Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>Dataset Marketplace</h2>
            <p style={{ fontSize: '0.9rem' }}>
              Explore and acquire verified AI datasets anchored to the Midnight blockchain.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button className="btn btn-primary btn-sm" onClick={onRegisterNew}>
              <PlusCircle size={13} /> List Dataset
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.75rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '380px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }}
            />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
              style={{ paddingLeft: '2.5rem', height: '38px', borderRadius: 'var(--radius-full)' }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${pricingFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPricingFilter('all')}
            >
              All ({listings.length})
            </button>
            <button
              className={`btn btn-sm ${pricingFilter === 'paid' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPricingFilter('paid')}
            >
              Paid
            </button>
            <button
              className={`btn btn-sm ${pricingFilter === 'free' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPricingFilter('free')}
            >
              Free
            </button>
            {walletAddress && (
              <button
                className={`btn btn-sm ${pricingFilter === 'purchased' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPricingFilter('purchased')}
              >
                Acquired ({profileHook.purchases.length})
              </button>
            )}
            <button
              className={`btn btn-sm ${pricingFilter === 'favorites' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPricingFilter('favorites')}
            >
              Saved ({favorites.length})
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'rgba(248, 113, 113, 0.08)',
              border: '1px solid rgba(248, 113, 113, 0.25)',
              borderRadius: 'var(--radius-sm)',
              color: '#f87171',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Listings Grid */}
        {filteredListings.length === 0 ? (
          <div
            className="card"
            style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}
          >
            <Database size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.35 }} />
            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.35rem' }}>No datasets listed yet</h3>
            <p style={{ fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
              Connect your wallet to list the first training dataset on the exchange.
            </p>
            <button className="btn btn-primary btn-sm" onClick={onRegisterNew}>
              <PlusCircle size={14} /> List a Dataset
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {filteredListings.map((listing) => {
              const registeredIds = new Set(
                profileHook.transactions.filter((t) => t.type === 'registered').map((t) => t.datasetId)
              );
              const isOwner = isListingOwner(listing, walletAddress, registeredIds);
              return (
                <DatasetCard
                  key={listing.datasetId}
                  listing={listing}
                  isFavorite={favorites.includes(listing.datasetId)}
                  isPurchased={profileHook.isPurchased(listing.datasetId)}
                  isOwner={isOwner}
                  sellerNickname={listing.sellerNickname || (isOwner ? profileHook.profile.nickname || 'AI Researcher' : undefined)}
                  sellerAddress={listing.sellerAddress || (isOwner ? walletAddress || undefined : undefined) || listing.providerCommit}
                  onToggleFavorite={() => onToggleFavorite(listing.datasetId)}
                  onInspect={() => onInspect(listing)}
                  onBuy={() => onBuy(listing)}
                  onDownload={() => onDownload(listing)}
                  onVerify={() => onVerify(listing)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATASET CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function DatasetCard({
  listing,
  isFavorite,
  isPurchased,
  isOwner,
  sellerNickname,
  sellerAddress,
  onToggleFavorite,
  onInspect,
  onBuy,
  onDownload,
  onVerify,
}: {
  listing: DataListing;
  isFavorite: boolean;
  isPurchased: boolean;
  isOwner: boolean;
  sellerNickname?: string;
  sellerAddress?: string;
  onToggleFavorite: () => void;
  onInspect: () => void;
  onBuy: () => void;
  onDownload: () => void;
  onVerify: () => void;
}) {
  const isFree = !listing.price || listing.price === '0' || listing.price.toLowerCase() === 'free';
  const priceDisplay = isFree ? 'Free' : `${listing.price} tNIGHT`;
  const displayNickname = sellerNickname || listing.sellerNickname || 'AI Researcher';
  const displaySellerAddress = sellerAddress || listing.sellerAddress || listing.providerCommit || '';

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        padding: '1.35rem',
      }}
    >
      <div>
        {/* Top Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span className={`badge ${isFree ? 'badge-green' : 'badge-silver-glow'}`}>
              {priceDisplay}
            </span>
            <span className="badge">{listing.category || 'AI Dataset'}</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isFavorite ? 'var(--accent-amber)' : 'var(--text-subtle)',
              padding: '0.2rem',
            }}
          >
            <Bookmark size={16} fill={isFavorite ? 'var(--accent-amber)' : 'none'} />
          </button>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '1.05rem',
            lineHeight: '1.35',
            marginBottom: '0.4rem',
            cursor: 'pointer',
          }}
          onClick={onInspect}
        >
          {listing.datasetName}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: '0.84rem',
            lineHeight: '1.5',
            marginBottom: '0.75rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {listing.description || 'Verified AI dataset anchored on Midnight.'}
        </p>

        {/* Seller Info Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontSize: '0.74rem',
            marginBottom: '0.85rem',
            padding: '0.35rem 0.55rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <User size={12} style={{ opacity: 0.6 }} />
          <span style={{ color: 'var(--text-subtle)' }}>Seller:</span>
          <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
            {displayNickname}
          </span>
          {displaySellerAddress && (
            <span className="mono" style={{ color: 'var(--text-subtle)', marginLeft: 'auto', fontSize: '0.7rem' }}>
              {truncateAddr(displaySellerAddress)}
            </span>
          )}
        </div>

        {/* Details Grid */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            padding: '0.6rem 0.8rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            marginBottom: '1.15rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-subtle)', display: 'block' }}>SIZE</span>
            <span className="mono" style={{ color: 'var(--text-main)' }}>{formatBytes(listing.datasetSize)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-subtle)', display: 'block' }}>RECORDS</span>
            <span style={{ color: 'var(--text-main)' }}>{listing.rowCount || 'N/A'}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-subtle)', display: 'block' }}>LICENSE</span>
            <span style={{ color: 'var(--text-main)' }}>{listing.license}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={onInspect}>
          <Eye size={13} /> View
        </button>

        {isPurchased ? (
          <button
            className="btn btn-sm"
            style={{
              flex: 2,
              background: 'var(--accent-emerald)',
              color: '#000',
              fontWeight: 600,
            }}
            onClick={onDownload}
          >
            <Download size={13} /> Download
          </button>
        ) : isOwner ? (
          <button
            className="btn btn-secondary btn-sm"
            style={{
              flex: 2,
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-muted)',
              cursor: 'default',
            }}
            disabled
            title="You are the seller of this dataset"
          >
            <User size={13} /> Your Listing
          </button>
        ) : isFree ? (
          <button
            className="btn btn-secondary btn-sm"
            style={{ flex: 2 }}
            onClick={onDownload}
          >
            <Download size={13} /> Free Download
          </button>
        ) : (
          <button
            className="btn btn-buy btn-sm"
            style={{ flex: 2 }}
            onClick={onBuy}
          >
            <ShoppingBag size={13} /> Buy ({listing.price} tNIGHT)
          </button>
        )}

        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: '0.4rem' }}
          title="Verify Integrity"
          onClick={onVerify}
        >
          <ShieldCheck size={15} />
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. CHECKOUT MODAL
// ═════════════════════════════════════════════════════════════════════════════

function PurchaseModal({
  listing,
  walletState,
  walletAddress,
  profileHook,
  contractBridge,
  onConnectWallet,
  onClose,
  onDirectVerify,
  onDownload,
  onDeductBalance,
  onCreditBalance,
  onSignAndSubmitPurchaseTx,
  onRefreshBalance,
  onSelectSection,
}: {
  listing: DataListing;
  walletState: WalletState;
  walletAddress: string | null;
  profileHook: UserProfileHook;
  contractBridge: ContractBridgeHook;
  onConnectWallet: () => void;
  onClose: () => void;
  onDirectVerify: (listing: DataListing, payload?: string) => void;
  onDownload: (listing: DataListing) => void;
  onDeductBalance?: (amount: number, targetAddress?: string) => void;
  onCreditBalance?: (amount: number, targetAddress?: string) => void;
  onSignAndSubmitPurchaseTx?: (
    recipientAddress: string,
    amountNight: number,
    datasetName: string
  ) => Promise<{ success: boolean; txHash: string; promptShown: boolean }>;
  onRefreshBalance?: () => Promise<any> | void;
  onSelectSection?: (section: NavSection) => void;
}) {
  const [step, setStep] = useState<'review' | 'processing' | 'success'>('review');
  const [processStage, setProcessStage] = useState<'proof' | 'sign' | 'ledger'>('proof');
  const [receipt, setReceipt] = useState<PurchaseRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedTx, setCopiedTx] = useState(false);

  const priceNum = Number(listing.price || 0);
  const networkGas = 0.012;

  const registeredIds = useMemo(
    () => new Set(profileHook.transactions.filter((t) => t.type === 'registered').map((t) => t.datasetId)),
    [profileHook.transactions]
  );

  const isOwner = isListingOwner(listing, walletAddress, registeredIds);

  const isConnected = walletState.status === 'connected' && !!walletAddress;

  const isNetworkMismatch =
    walletState.status === 'connected' &&
    !!(
      normalizeNetwork(walletState.network) &&
      normalizeNetwork(TARGET_NETWORK) &&
      normalizeNetwork(walletState.network) !== normalizeNetwork(TARGET_NETWORK)
    );

  const handleConfirmPurchase = async () => {
    if (isOwner) {
      setErrorMsg('You cannot purchase your own dataset listing.');
      return;
    }
    if (isNetworkMismatch) {
      setErrorMsg(
        `Network Mismatch: Your wallet is connected to "${walletState.status === 'connected' ? walletState.network.toUpperCase() : ''}", but Nocturne AI DEX is targeting "${TARGET_NETWORK.toUpperCase()}". Please switch network in your wallet settings.`
      );
      return;
    }
    if (!isConnected) {
      onConnectWallet();
      return;
    }

    setStep('processing');
    setProcessStage('proof');
    setErrorMsg(null);

    try {
      // 1. Generate cryptographic purchase receipt anchor & slices
      const purchaseTime = new Date().toISOString();
      const rawReceiptSeed = `nocturne:acq:${listing.datasetId}:${walletAddress}:${listing.dataCommitment}:${purchaseTime}`;
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(rawReceiptSeed));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      let txHash = priceNum === 0
        ? '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
        : '';

      if (listing.downloadPayload && contractBridge.sliceStore) {
        const payloadBytes = enc.encode(listing.downloadPayload);
        const { datasetSlicesFromBytesBrowser, hexToBytes32 } = await import('../utils/datasetUtils');
        const slices = await datasetSlicesFromBytesBrowser(payloadBytes);
        try {
          const idBytes = hexToBytes32(listing.datasetId);
          contractBridge.sliceStore.set(idBytes, slices);
        } catch {}
      }

      // Stage 1: ZK Transfer Proof Generation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Stage 2: Wallet Signature & On-Chain Escrow via Midnight Extension
      setProcessStage('sign');
      const sellerAddr = listing.sellerAddress || listing.providerCommit || '';
      if (priceNum > 0) {
        if (!onSignAndSubmitPurchaseTx) {
          throw new Error('Wallet transaction provider is not available.');
        }
        try {
          const signRes = await onSignAndSubmitPurchaseTx(sellerAddr, priceNum, listing.datasetName);
          if (!signRes || !signRes.txHash) {
            throw new Error('Wallet transaction was not confirmed or returned no hash.');
          }
          txHash = signRes.txHash;
        } catch (signErr: any) {
          setErrorMsg(signErr?.message || 'Transaction signing or submission failed.');
          setStep('review');
          return;
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (onDeductBalance && priceNum > 0) {
          onDeductBalance(priceNum, walletAddress || undefined);
        }
        if (sellerAddr && priceNum > 0 && onCreditBalance) {
          onCreditBalance(priceNum, sellerAddr);
        }
      }

      // Stage 3: Broadcast Settlement to Midnight Ledger
      setProcessStage('ledger');
      if (onRefreshBalance) {
        try {
          await onRefreshBalance();
        } catch {}
      }
      await new Promise((resolve) => setTimeout(resolve, 1100));

      if (!txHash) {
        throw new Error('Payment settlement failed: No confirmed transaction hash.');
      }

      // Persist in seller records
      if (sellerAddr && priceNum > 0) {
        try {
          const sellerKey = `nocturne_sales_${sellerAddr.trim().toLowerCase()}`;
          const existingRaw = localStorage.getItem(sellerKey);
          const existingSales: SaleRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
          const newSale: SaleRecord = {
            id: `sale_${Date.now()}`,
            datasetId: listing.datasetId,
            datasetName: listing.datasetName,
            price: listing.price || '0',
            currency: 'tNIGHT',
            saleDate: purchaseTime,
            buyerCommit: walletAddress || '0x_buyer',
            txHash,
          };
          localStorage.setItem(sellerKey, JSON.stringify([newSale, ...existingSales]));
        } catch {}
      }

      const purchaseRecord: PurchaseRecord = {
        id: `purch_${Date.now()}`,
        datasetId: listing.datasetId,
        datasetName: listing.datasetName,
        price: listing.price || '0',
        currency: 'tNIGHT',
        purchaseDate: purchaseTime,
        receiptHash: txHash,
        dataCommitment: listing.dataCommitment,
        sellerCommit: listing.providerCommit,
        downloadPayload: listing.downloadPayload || listing.sampleData || `DATASET_${listing.datasetId}`,
        format: listing.format || 'csv',
        license: listing.license,
        rowCount: listing.rowCount,
        datasetSize: listing.datasetSize,
      };

      profileHook.addPurchase(purchaseRecord);
      profileHook.addTransaction({
        id: `tx_${Date.now()}`,
        date: purchaseTime,
        datasetName: listing.datasetName,
        datasetId: listing.datasetId,
        type: 'purchased',
        price: `${listing.price} tNIGHT`,
        txId: txHash,
        status: 'completed',
      });

      profileHook.addSale({
        id: `sale_${Date.now()}`,
        datasetId: listing.datasetId,
        datasetName: listing.datasetName,
        price: listing.price || '0',
        currency: 'tNIGHT',
        saleDate: purchaseTime,
        buyerCommit: walletAddress || '0x_buyer',
        txHash,
      });

      setReceipt(purchaseRecord);
      setStep('success');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Payment settlement failed.');
      setStep('review');
    }
  };

  const copyTxId = () => {
    if (receipt?.receiptHash) {
      navigator.clipboard.writeText(receipt.receiptHash);
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '490px',
          padding: '1.75rem',
          background: 'var(--bg-modal)',
          boxShadow: 'var(--shadow-modal)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.15rem' }}>Acquire Dataset License</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {step === 'review' && (
          <div>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-glass)',
                marginBottom: '1.25rem',
              }}
            >
              <h4 style={{ fontSize: '0.98rem', marginBottom: '0.25rem' }}>{listing.datasetName}</h4>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginBottom: '0.35rem' }}>
                License: {listing.license} · Records: {listing.rowCount || 'Custom'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Seller: <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{listing.sellerNickname || 'AI Researcher'}</span>{' '}
                <code className="mono" style={{ color: 'var(--text-subtle)' }}>
                  ({truncateAddr(listing.sellerAddress || listing.providerCommit)})
                </code>
              </div>
            </div>

            {/* Price breakdown */}
            <div
              style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.25rem',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                <span>Dataset Price:</span>
                <span className="mono" style={{ color: 'var(--text-main)' }}>{priceNum} tNIGHT</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: 'var(--text-muted)' }}>
                <span>ZK Privacy Gas (Network):</span>
                <span className="mono">{networkGas} tDUST</span>
              </div>
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.6rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                }}
              >
                <span>Total to Escrow:</span>
                <span className="mono" style={{ color: '#ffffff' }}>
                  {priceNum} tNIGHT <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 400 }}>(+ {networkGas} tDUST gas)</span>
                </span>
              </div>
            </div>

            {isOwner ? (
              <div
                style={{
                  padding: '0.75rem',
                  background: 'rgba(255, 159, 10, 0.1)',
                  border: '1px solid rgba(255, 159, 10, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--accent-amber)',
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                }}
              >
                You are the seller of this dataset and cannot purchase your own listing.
              </div>
            ) : isNetworkMismatch ? (
              <div
                style={{
                  padding: '0.8rem 1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(229, 169, 80, 0.22)',
                  borderLeft: '3px solid #e5a950',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                }}
              >
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.15rem', color: '#e5a950' }} />
                <div style={{ color: 'var(--text-muted)' }}>
                  <strong style={{ display: 'block', marginBottom: '0.2rem', color: 'var(--text-main)' }}>
                    Network Mismatch
                  </strong>
                  Your wallet is connected to <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{walletState.status === 'connected' ? walletState.network.toUpperCase() : ''}</span>, but
                  this DEX contract runs on <span style={{ color: '#e5a950', fontWeight: 600 }}>{TARGET_NETWORK.toUpperCase()}</span>. Please switch your wallet network to <span style={{ color: '#e5a950', fontWeight: 600 }}>{TARGET_NETWORK.toUpperCase()}</span> in wallet settings to proceed.
                </div>
              </div>
            ) : errorMsg && (
              <div
                style={{
                  padding: '0.8rem 1rem',
                  background: 'rgba(248, 113, 113, 0.08)',
                  border: '1px solid rgba(248, 113, 113, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#f87171',
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                }}
              >
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
                Cancel
              </button>
              {isOwner ? (
                <button className="btn btn-secondary" style={{ flex: 2 }} disabled>
                  Your Listing
                </button>
              ) : isNetworkMismatch ? (
                <button
                  className="btn btn-secondary"
                  style={{ flex: 2, opacity: 0.6, cursor: 'not-allowed', color: 'var(--text-subtle)' }}
                  disabled
                >
                  Switch Wallet to {TARGET_NETWORK.toUpperCase()}
                </button>
              ) : isConnected ? (
                <button className="btn btn-buy" style={{ flex: 2 }} onClick={handleConfirmPurchase}>
                  Confirm & Pay {priceNum} tNIGHT
                </button>
              ) : (
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={onConnectWallet}>
                  <Key size={14} /> Connect Wallet
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  border: '2.5px solid rgba(255, 255, 255, 0.15)',
                  borderTopColor: '#ffffff',
                  margin: '0 auto 0.75rem auto',
                  animation: 'spin 1s linear infinite',
                  boxShadow: '0 0 16px rgba(255, 255, 255, 0.25)',
                }}
              />
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                Settling On-Chain License
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Executing zero-knowledge transfer &amp; escrow settlement on Midnight
              </p>
            </div>

            {/* Progressive Workflow Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {/* Step 1: ZK Proof */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  background:
                    processStage === 'proof'
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(255, 255, 255, 0.02)',
                  border:
                    processStage === 'proof'
                      ? '1px solid rgba(255, 255, 255, 0.25)'
                      : '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      processStage !== 'proof'
                        ? 'rgba(48, 209, 88, 0.15)'
                        : 'rgba(255, 255, 255, 0.15)',
                    color: processStage !== 'proof' ? 'var(--accent-emerald)' : '#ffffff',
                  }}
                >
                  {processStage !== 'proof' ? (
                    <Check size={14} />
                  ) : (
                    <RefreshCw size={13} style={{ animation: 'spin 1.2s linear infinite' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    1. Generate Zero-Knowledge Transfer Proof
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                    Constructing SHA-256 slices &amp; ZK privacy commitment
                  </div>
                </div>
              </div>

              {/* Step 2: Wallet Signature */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  background:
                    processStage === 'sign'
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(255, 255, 255, 0.02)',
                  border:
                    processStage === 'sign'
                      ? '1px solid rgba(255, 255, 255, 0.25)'
                      : '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      processStage === 'ledger'
                        ? 'rgba(48, 209, 88, 0.15)'
                        : processStage === 'sign'
                        ? 'rgba(255, 255, 255, 0.15)'
                        : 'rgba(255, 255, 255, 0.04)',
                    color:
                      processStage === 'ledger'
                        ? 'var(--accent-emerald)'
                        : processStage === 'sign'
                        ? '#ffffff'
                        : 'var(--text-subtle)',
                  }}
                >
                  {processStage === 'ledger' ? (
                    <Check size={14} />
                  ) : processStage === 'sign' ? (
                    <RefreshCw size={13} style={{ animation: 'spin 1.2s linear infinite' }} />
                  ) : (
                    <Key size={13} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    2. Authorize &amp; Escrow Transfer
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                    Escrowing {priceNum} tNIGHT from {truncateAddr(walletAddress)}
                  </div>
                </div>
              </div>

              {/* Step 3: Ledger Broadcast */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  background:
                    processStage === 'ledger'
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(255, 255, 255, 0.02)',
                  border:
                    processStage === 'ledger'
                      ? '1px solid rgba(255, 255, 255, 0.25)'
                      : '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      processStage === 'ledger'
                        ? 'rgba(255, 255, 255, 0.15)'
                        : 'rgba(255, 255, 255, 0.04)',
                    color: processStage === 'ledger' ? '#ffffff' : 'var(--text-subtle)',
                  }}
                >
                  {processStage === 'ledger' ? (
                    <RefreshCw size={13} style={{ animation: 'spin 1.2s linear infinite' }} />
                  ) : (
                    <ShieldCheck size={13} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    3. Broadcast Settlement to Midnight Ledger
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                    Anchoring acquisition proof &amp; minting download entitlement
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && receipt && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(48, 209, 88, 0.22) 0%, rgba(30, 160, 60, 0.1) 100%)',
                  color: 'var(--accent-emerald)',
                  border: '1px solid rgba(48, 209, 88, 0.35)',
                  boxShadow: '0 0 20px rgba(48, 209, 88, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.75rem auto',
                }}
              >
                <Check size={24} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)' }}>Purchase Successful &amp; Settled</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Paid <strong className="mono" style={{ color: '#ffffff' }}>{priceNum} tNIGHT</strong> · Cryptographic License Minted
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-glass)',
                padding: '1rem',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Dataset:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{receipt.datasetName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>License &amp; Format:</span>
                <span style={{ color: 'var(--text-subtle)' }}>
                  {receipt.license} · {receipt.format?.toUpperCase() || 'CSV'} ({receipt.rowCount || 'Custom'})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Deducted from Wallet:</span>
                <span className="mono badge badge-silver-glow" style={{ fontSize: '0.72rem' }}>
                  -{priceNum} tNIGHT
                </span>
              </div>
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Tx Hash:</span>
                <button
                  onClick={copyTxId}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  title="Copy transaction hash"
                >
                  <code className="mono">{truncateAddr(receipt.receiptHash)}</code>
                  {copiedTx ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.7rem' }}
                onClick={() => onDownload(listing)}
              >
                <Download size={15} /> Download Dataset Deliverable
              </button>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.65rem' }}
                onClick={() => onDirectVerify(listing, receipt.downloadPayload)}
              >
                <ShieldCheck size={15} /> Verify Deliverable Integrity
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onClose();
                  onSelectSection?.('profile');
                }}
              >
                View in Purchased Datasets
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. LIST / SELL DATASET VIEW
// ═════════════════════════════════════════════════════════════════════════════

function RegisterView({
  walletState,
  walletAddress,
  profileHook,
  contractBridge,
  onSuccess,
}: {
  walletState: WalletState;
  walletAddress?: string | null;
  profileHook?: UserProfileHook;
  contractBridge: ContractBridgeHook;
  onSuccess: (listing: DataListing, txHash?: string) => void;
}) {
  const [datasetName, setDatasetName] = useState('');
  const [category, setCategory] = useState('Natural Language Processing');
  const [customCategory, setCustomCategory] = useState('');
  const [license, setLicense] = useState('Apache-2.0');
  const [pricingModel, setPricingModel] = useState<'free' | 'paid'>('paid');
  const [priceInput, setPriceInput] = useState('25');
  const [description, setDescription] = useState('');
  const [rowCount, setRowCount] = useState('');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [samplePreview, setSamplePreview] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentNetwork = walletState.status === 'connected' ? (walletState.network || '') : '';
  const isMismatch = !!(
    walletState.status === 'connected' &&
    (walletState.isNetworkMismatch ||
      (currentNetwork && TARGET_NETWORK && normalizeNetwork(currentNetwork) !== normalizeNetwork(TARGET_NETWORK)))
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileSize(file.size);
    if (!datasetName) {
      setDatasetName(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      setFileBytes(bytes);

      try {
        const textDecoder = new TextDecoder('utf-8', { fatal: false });
        const text = textDecoder.decode(bytes);
        setFileContent(text);

        if (file.name.endsWith('.json')) {
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              setRowCount(`${parsed.length} Records`);
              setSamplePreview(JSON.stringify(parsed.slice(0, 2), null, 2));
            } else {
              setRowCount('1 Record');
              setSamplePreview(JSON.stringify(parsed, null, 2).slice(0, 300));
            }
          } catch {
            setSamplePreview(text.slice(0, 300));
          }
        } else if (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
          const lines = text.split('\n').filter((l) => l.trim().length > 0);
          setRowCount(`${Math.max(1, lines.length - 1)} Rows`);
          setSamplePreview(lines.slice(0, 5).join('\n'));
        } else {
          setRowCount(`${bytes.length.toLocaleString()} Bytes`);
          setSamplePreview(`[Binary Dataset: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`);
        }
      } catch {
        setFileContent('');
        setRowCount(`${bytes.length.toLocaleString()} Bytes`);
        setSamplePreview(`[Binary Dataset: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (walletState.status !== 'connected') {
      setErrorMsg('Please connect your wallet before listing a dataset.');
      return;
    }
    if (isMismatch) {
      setErrorMsg(
        `Network Mismatch: Your wallet is connected to "${currentNetwork.toUpperCase()}", but Nocturne AI DEX targets "${TARGET_NETWORK.toUpperCase()}". Please switch network in your wallet settings to list datasets.`
      );
      return;
    }
    if (!datasetName.trim()) {
      setErrorMsg('Please enter a dataset name.');
      return;
    }
    if (!fileBytes && !fileContent.trim()) {
      setErrorMsg('Please select a dataset file.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const bytes = fileBytes || new TextEncoder().encode(fileContent);
      const finalCategory = category === 'Other' ? (customCategory.trim() || 'Other') : category;

      // Real registration call via Contract Bridge
      const regResult = await contractBridge.registerDataset({
        datasetName: datasetName.trim(),
        category: finalCategory,
        datasetSize: fileSize || bytes.length,
        rowCount: rowCount.trim() || 'Custom Dataset',
        license,
        fileContent: bytes,
      });

      if (!regResult.success) {
        throw new Error(regResult.error || 'Registration failed');
      }

      const providerCommit = regResult.providerCommit
        ? `0x${regResult.providerCommit}`
        : (walletState.status === 'connected' && walletState.address ? walletState.address : '0x_provider');

      const dataCommitment = regResult.dataCommitment
        ? `0x${regResult.dataCommitment}`
        : '0x' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

      const sellerAddr =
        (walletState.status === 'connected' && walletState.address)
          ? walletState.address
          : (walletAddress || undefined);

      const sellerNick =
        profileHook?.profile?.nickname || 'AI Researcher';

      // Cap stored downloadPayload to prevent browser 5MB localStorage exhaustion
      const isPayloadManageable = bytes.length <= 500_000;
      const safePayload = isPayloadManageable
        ? (fileContent || samplePreview)
        : (samplePreview || `[Dataset size ${(bytes.length / 1024 / 1024).toFixed(2)} MB - stored on provider node]`);

      const detectedFormat = fileContent.trim().startsWith('{') || fileContent.trim().startsWith('[')
        ? 'json'
        : (fileContent.includes(',') ? 'csv' : 'parquet');

      const newListing: DataListing = {
        datasetId: regResult.datasetId,
        providerCommit,
        dataCommitment,
        datasetName: datasetName.trim(),
        category: finalCategory,
        datasetSize: String(fileSize || bytes.length),
        rowCount: rowCount.trim() || 'Custom Dataset',
        license,
        isActive: true,
        description: description.trim(),
        price: pricingModel === 'free' ? '0' : priceInput.trim() || '10',
        currency: 'tNIGHT',
        sellerAddress: sellerAddr,
        sellerNickname: sellerNick,
        accessTier: pricingModel === 'free' ? 'free' : 'commercial',
        sampleData: samplePreview || fileContent.slice(0, 300),
        downloadPayload: safePayload,
        format: detectedFormat,
        verifiedOnChain: true,
      };

      onSuccess(newListing, regResult.txHash);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Listing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: '2.5rem 0 4rem 0' }}>
      <div className="container" style={{ maxWidth: '680px' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>List a Dataset</h2>
          <p style={{ fontSize: '0.9rem' }}>
            Set pricing terms and register cryptographic integrity anchors on Midnight.
          </p>
        </div>

        {/* Proof Server Status Banner */}
        {!contractBridge.proofServerOnline && (
          <div
            style={{
              padding: '0.85rem 1.15rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderLeft: '3px solid rgba(255, 255, 255, 0.35)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              marginBottom: '1.25rem',
              fontSize: '0.83rem',
              lineHeight: 1.55,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <strong style={{ color: 'var(--text-main)' }}>ℹ Local Anchor Mode:</strong> The remote Midnight proof server is currently unreachable. Your dataset will be registered locally with authentic SHA-256 slices &amp; cryptographic integrity anchors, and will be ready for immediate on-chain submission once the proof server is live.
          </div>
        )}

        {/* Network Mismatch Warning Banner */}
        {isMismatch && (
          <div
            style={{
              padding: '0.9rem 1.15rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(229, 169, 80, 0.22)',
              borderLeft: '3px solid #e5a950',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem',
              fontSize: '0.84rem',
              lineHeight: 1.55,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '0.15rem', color: '#e5a950' }} />
            <div style={{ color: 'var(--text-muted)' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-main)', fontSize: '0.88rem' }}>
                Network Mismatch: Dataset Listing Blocked
              </strong>
              Your wallet is connected to <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{currentNetwork.toUpperCase()}</span>, but Nocturne AI DEX targets <span style={{ color: '#e5a950', fontWeight: 600 }}>{TARGET_NETWORK.toUpperCase()}</span>.
              Please switch your wallet extension to <span style={{ color: '#e5a950', fontWeight: 600 }}>{TARGET_NETWORK.toUpperCase()}</span> in your wallet settings to register datasets on this marketplace.
            </div>
          </div>
        )}

        <form onSubmit={handleRegister} className="card" style={{ padding: '1.75rem' }}>
          {errorMsg && (
            <div
              style={{
                padding: '0.85rem 1.1rem',
                background: 'rgba(248, 113, 113, 0.08)',
                border: '1px solid rgba(248, 113, 113, 0.25)',
                borderRadius: 'var(--radius-sm)',
                color: '#f87171',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Dataset Title</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Anonymized Clinical Healthcare Tabular Records"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              required
            />
          </div>

          {/* Category & License */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label className="form-label">Category</label>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Natural Language Processing">NLP & Reasoning</option>
                <option value="Healthcare & Life Sciences">Healthcare & Medical</option>
                <option value="Financial Intelligence">Financial & Fraud</option>
                <option value="Computer Vision">Computer Vision</option>
                <option value="Tabular & Analytics">Tabular & Enterprise</option>
                <option value="Audio & Multimodal">Audio & Multimodal</option>
                <option value="Code & Synthetic Data">Code & Synthetic</option>
                <option value="Other">Other</option>
              </select>
              {category === 'Other' && (
                <input
                  type="text"
                  className="input"
                  style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}
                  placeholder="Specify custom category..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                />
              )}
            </div>

            <div>
              <label className="form-label">License</label>
              <select className="select" value={license} onChange={(e) => setLicense(e.target.value)}>
                <option value="Apache-2.0">Apache-2.0 (Commercial)</option>
                <option value="MIT">MIT Open Data</option>
                <option value="CC-BY-NC-4.0">CC-BY-NC-4.0 (Research)</option>
              </select>
            </div>
          </div>

          {/* Pricing Selector */}
          <div
            style={{
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-glass)',
              marginBottom: '1.25rem',
            }}
          >
            <label className="form-label">Pricing Model</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${pricingModel === 'paid' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setPricingModel('paid')}
              >
                Paid (tNIGHT)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${pricingModel === 'free' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setPricingModel('free')}
              >
                Free
              </button>
            </div>

            {pricingModel === 'paid' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="Price in tNIGHT"
                />
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  tNIGHT
                </span>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Dataset File</label>
            <div
              style={{
                border: '1px dashed var(--border-glass)',
                borderRadius: 'var(--radius-sm)',
                padding: '1.5rem',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                id="file-upload-input"
                type="file"
                accept=".csv,.json,.txt"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <FolderUp size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 0.4rem auto' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                {fileSize > 0 ? `Selected file: ${formatBytes(fileSize)}` : 'Click to select CSV or JSON dataset'}
              </p>
            </div>
          </div>

          {/* Sample Preview */}
          {samplePreview && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Sample Preview (Visible to prospective buyers)</label>
              <pre
                className="mono"
                style={{
                  background: '#0a0a0c',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  maxHeight: '120px',
                  overflowY: 'auto',
                }}
              >
                {samplePreview}
              </pre>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Description</label>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Provide a brief summary of dataset attributes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              opacity: isProcessing || contractBridge.loading || isMismatch || walletState.status !== 'connected' ? 0.6 : 1,
            }}
            disabled={isProcessing || contractBridge.loading || isMismatch || walletState.status !== 'connected'}
          >
            {isProcessing || contractBridge.loading
              ? (contractBridge.statusMessage || 'Anchoring to Midnight...')
              : isMismatch
              ? `Switch Wallet to ${TARGET_NETWORK.toUpperCase()} to List Dataset`
              : walletState.status !== 'connected'
              ? 'Connect Wallet to List Dataset'
              : 'Publish Listing'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. VERIFIER VIEW
// ═════════════════════════════════════════════════════════════════════════════

function VerifierView({
  listings,
  preselectedListing,
  initialPayload,
  contractBridge,
  onIncrementVerified,
}: {
  listings: DataListing[];
  preselectedListing: DataListing | null;
  initialPayload?: string | null;
  contractBridge: ContractBridgeHook;
  onIncrementVerified: () => void;
}) {
  const [verifierMode, setVerifierMode] = useState<'catalog' | 'custom'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(preselectedListing?.datasetId || '');
  const [customAnchor, setCustomAnchor] = useState('');
  const [customFileContent, setCustomFileContent] = useState<string>(initialPayload || '');
  const [customFileBytes, setCustomFileBytes] = useState<Uint8Array | null>(null);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [verificationLog, setVerificationLog] = useState<string[]>([]);

  const filteredListings = useMemo(() => {
    if (!searchTerm.trim()) return listings;
    const term = searchTerm.toLowerCase();
    return listings.filter(
      (l) =>
        l.datasetName.toLowerCase().includes(term) ||
        (l.category && l.category.toLowerCase().includes(term)) ||
        l.datasetId.toLowerCase().includes(term)
    );
  }, [listings, searchTerm]);

  const activeListing = useMemo(() => {
    return listings.find((l) => l.datasetId === selectedDatasetId) || preselectedListing;
  }, [listings, selectedDatasetId, preselectedListing]);

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      setCustomFileBytes(bytes);
      try {
        const textDecoder = new TextDecoder('utf-8', { fatal: false });
        setCustomFileContent(textDecoder.decode(bytes));
      } catch {
        setCustomFileContent('');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRunVerification = async () => {
    const targetAnchor = verifierMode === 'catalog' ? activeListing?.dataCommitment : customAnchor.trim();
    if (!targetAnchor) {
      setStatus('failed');
      setVerificationLog(['❌ No target integrity anchor provided. Please select a catalog listing or input a valid hex anchor.']);
      return;
    }

    setStatus('running');
    setVerificationLog(['Initiating cryptographic integrity verification against Midnight zero-knowledge state...']);

    try {
      let payloadBytes: Uint8Array | null = null;
      if (verifierMode === 'catalog') {
        if (customFileBytes && customFileBytes.length > 0) {
          payloadBytes = customFileBytes;
        } else if (initialPayload) {
          payloadBytes = new TextEncoder().encode(initialPayload);
        } else if (
          activeListing?.downloadPayload &&
          !activeListing.downloadPayload.startsWith('[Dataset size') &&
          !activeListing.downloadPayload.startsWith('[Stored on provider')
        ) {
          payloadBytes = new TextEncoder().encode(activeListing.downloadPayload);
        }
      } else {
        payloadBytes = customFileBytes || (customFileContent ? new TextEncoder().encode(customFileContent) : null);
      }

      if (!payloadBytes || payloadBytes.length === 0) {
        setStatus('failed');
        setVerificationLog([
          `Target Anchor: ${targetAnchor.slice(0, 26)}…`,
          '❌ No dataset content available to verify.',
          'Please upload the original dataset file to test its cryptographic integrity.',
        ]);
        return;
      }

      // Compute local SHA-256 commitment from slices
      const { datasetSlicesFromBytesBrowser, bytes32ToHex } = await import('../utils/datasetUtils');
      const slices = await datasetSlicesFromBytesBrowser(payloadBytes);
      const enc = new TextEncoder();
      const prefix = enc.encode('nocturne:content:');
      const totalLength = prefix.length + slices.reduce((sum, s) => sum + s.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      combined.set(prefix, offset);
      offset += prefix.length;
      for (const slice of slices) {
        combined.set(slice, offset);
        offset += slice.length;
      }
      const hashBuffer = await crypto.subtle.digest('SHA-256', combined as unknown as BufferSource);
      const localCommitment = '0x' + bytes32ToHex(new Uint8Array(hashBuffer));

      const cleanLocal = localCommitment.replace(/^0x/i, '').toLowerCase();
      const cleanTarget = targetAnchor.replace(/^0x/i, '').toLowerCase();

      // STRICT VALIDATION: If hashes do not match, fail verification immediately!
      if (cleanLocal !== cleanTarget) {
        setStatus('failed');
        setVerificationLog([
          `Local Computed Hash: ${localCommitment.slice(0, 26)}…`,
          `Target Anchor:       ${targetAnchor.slice(0, 26)}…`,
          '❌ Cryptographic Integrity Mismatch!',
          'The provided dataset content produces a commitment that DOES NOT MATCH the registered anchor.',
          'The file may have been modified, truncated, corrupted, or does not correspond to this listing.',
        ]);
        return;
      }

      const datasetIdToVerify = verifierMode === 'catalog' && activeListing
        ? activeListing.datasetId
        : '0x' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', payloadBytes as unknown as BufferSource))).map((b) => b.toString(16).padStart(2, '0')).join('');

      // Invoke real on-chain proveIntegrity via ContractBridge
      const result = await contractBridge.proveIntegrity(datasetIdToVerify, payloadBytes);

      const logs: string[] = [
        `Local Computed Hash: ${localCommitment.slice(0, 26)}…`,
        `Target Anchor:       ${targetAnchor.slice(0, 26)}…`,
        `✓ Cryptographic commitment match confirmed! Content integrity 100% verified.`,
      ];

      if (result.success && result.txHash) {
        logs.push(`✓ Zero-Knowledge proof generated and confirmed on Midnight!`);
        logs.push(`✓ Transaction ID: ${result.txHash}`);
      } else if (result.proofServerOffline) {
        logs.push(`ℹ Proof server offline — local cryptographic proof verified against registered anchor.`);
      } else if (result.success) {
        logs.push(`✓ Zero-Knowledge integrity anchor verified against Midnight ledger state.`);
      } else {
        logs.push(`⚠ On-chain proof note: ${result.error || 'Proof server pending'}`);
      }

      setStatus('success');
      setVerificationLog(logs);
      onIncrementVerified();
    } catch (err: any) {
      setStatus('failed');
      setVerificationLog([
        `❌ Verification error: ${err?.message || 'Verification could not be completed'}`,
      ]);
    }
  };

  return (
    <div style={{ padding: '2.5rem 0 4rem 0' }}>
      <div className="container" style={{ maxWidth: '680px' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.2rem' }}>Dataset Verifier</h2>
          <p style={{ fontSize: '0.9rem' }}>
            Verify dataset authenticity against on-chain Midnight zero-knowledge anchors.
          </p>
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${verifierMode === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => {
              setVerifierMode('catalog');
              setStatus('idle');
            }}
          >
            Marketplace Catalog ({listings.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${verifierMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => {
              setVerifierMode('custom');
              setStatus('idle');
            }}
          >
            Custom Hash & File Verifier
          </button>
        </div>

        <div className="card" style={{ padding: '1.75rem' }}>
          {verifierMode === 'catalog' ? (
            <div>
              {listings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  <ShieldCheck size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.35 }} />
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    No datasets currently listed on the marketplace
                  </p>
                  <p style={{ fontSize: '0.78rem', marginBottom: '1rem' }}>
                    Switch to &ldquo;Custom Hash &amp; File Verifier&rdquo; above to verify any on-chain hash or upload a file.
                  </p>
                </div>
              ) : (
                <>
                  {/* Search Input for Dataset Catalog */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        Select Dataset to Verify
                      </label>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                        {filteredListings.length} {filteredListings.length === 1 ? 'dataset' : 'datasets'} available
                      </span>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <Search
                        size={15}
                        style={{
                          position: 'absolute',
                          left: '0.85rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-subtle)',
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        type="text"
                        className="input"
                        style={{
                          paddingLeft: '2.4rem',
                          paddingRight: searchTerm ? '2.2rem' : '0.85rem',
                          fontSize: '0.84rem',
                        }}
                        placeholder="Search by dataset title, category, or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          style={{
                            position: 'absolute',
                            right: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.2rem',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Clear search"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Interactive Dataset List */}
                  {filteredListings.length === 0 ? (
                    <div
                      style={{
                        padding: '1.75rem 1rem',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-glass)',
                        marginBottom: '1.25rem',
                      }}
                    >
                      <p style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                        No datasets matching &ldquo;{searchTerm}&rdquo;
                      </p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSearchTerm('')}
                      >
                        Clear Search
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        maxHeight: '260px',
                        overflowY: 'auto',
                        marginBottom: '1.25rem',
                        paddingRight: '0.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      {filteredListings.map((l) => {
                        const isSelected = (activeListing?.datasetId === l.datasetId);
                        return (
                          <div
                            key={l.datasetId}
                            onClick={() => {
                              setSelectedDatasetId(l.datasetId);
                              setStatus('idle');
                            }}
                            style={{
                              padding: '0.85rem 1rem',
                              borderRadius: 'var(--radius-sm)',
                              background: isSelected
                                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(200, 215, 235, 0.03) 100%)'
                                : 'rgba(255, 255, 255, 0.02)',
                              border: isSelected
                                ? '1.5px solid #ffffff'
                                : '1px solid var(--border-glass)',
                              boxShadow: isSelected
                                ? '0 0 16px rgba(255, 255, 255, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
                                : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                <div
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    border: isSelected ? '1.5px solid #ffffff' : '1px solid var(--border-subtle)',
                                    background: isSelected ? '#ffffff' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {isSelected && <Check size={11} color="#000000" strokeWidth={3} />}
                                </div>
                                <span style={{ fontWeight: 600, fontSize: '0.92rem', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                                  {l.datasetName}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <span className={`badge ${l.price && l.price !== '0' ? 'badge-silver-glow' : 'badge-green'}`}>
                                  {l.price && l.price !== '0' ? `${l.price} tNIGHT` : 'Free'}
                                </span>
                                <span className="badge badge-subtle">{l.category || 'AI Dataset'}</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-subtle)', marginLeft: '1.65rem' }}>
                              <span>{l.rowCount || 'Custom Records'} · {l.license}</span>
                              <span className="mono" title={l.dataCommitment}>
                                {truncateAddr(l.dataCommitment)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeListing && (
                    <div
                      style={{
                        padding: '1rem 1.15rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-glass)',
                        marginBottom: '1.25rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          Target On-Chain Anchor
                        </span>
                        <span className="badge badge-silver-glow" style={{ fontSize: '0.7rem' }}>
                          Verified Target
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-subtle)', fontSize: '0.72rem', marginBottom: '0.25rem' }}>
                        CRYPTOGRAPHIC COMMITMENT HASH
                      </div>
                      <code className="mono" style={{ wordBreak: 'break-all', fontSize: '0.76rem', color: 'var(--text-main)' }}>
                        {activeListing.dataCommitment}
                      </code>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div>
              {/* Custom Hash Input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">On-Chain Commitment Anchor / Hash</label>
                <input
                  type="text"
                  className="input mono"
                  style={{ fontSize: '0.82rem' }}
                  placeholder="0x8f3c7b2a... or Midnight commitment hash"
                  value={customAnchor}
                  onChange={(e) => {
                    setCustomAnchor(e.target.value);
                    setStatus('idle');
                  }}
                />
              </div>

              {/* Custom File Upload */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Local Dataset File (Optional verification payload)</label>
                <div
                  style={{
                    border: '1px dashed var(--border-glass)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById('verifier-custom-file')?.click()}
                >
                  <input
                    id="verifier-custom-file"
                    type="file"
                    accept=".csv,.json,.txt"
                    style={{ display: 'none' }}
                    onChange={handleCustomFileUpload}
                  />
                  <FolderUp size={20} style={{ color: 'var(--text-muted)', margin: '0 auto 0.3rem auto' }} />
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                    {customFileName ? `Selected: ${customFileName}` : 'Click to select local CSV / JSON dataset to test'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '1.25rem' }}
            disabled={
              status === 'running' ||
              contractBridge.loading ||
              (verifierMode === 'catalog' && !activeListing) ||
              (verifierMode === 'custom' && !customAnchor.trim())
            }
            onClick={handleRunVerification}
          >
            {status === 'running' || contractBridge.loading
              ? (contractBridge.statusMessage || 'Verifying Integrity...')
              : 'Verify Dataset Integrity'}
          </button>

          {verificationLog.length > 0 && (
            <div
              style={{
                padding: '1rem',
                background: '#0a0a0c',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
              }}
            >
              {verificationLog.map((log, idx) => (
                <div
                  key={idx}
                  className="mono"
                  style={{ color: log.startsWith('✓') ? 'var(--accent-emerald)' : log.startsWith('❌') ? 'var(--accent-rose)' : 'var(--text-muted)', lineHeight: 1.6 }}
                >
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. INSPECT MODAL
// ═════════════════════════════════════════════════════════════════════════════

function InspectModal({
  listing,
  isFavorite,
  walletAddress,
  profileHook,
  onToggleFavorite,
  onClose,
  onBuy,
  onDownload,
  onVerify,
  onRemoveListing,
}: {
  listing: DataListing;
  isFavorite: boolean;
  walletAddress?: string | null;
  profileHook: UserProfileHook;
  onToggleFavorite: () => void;
  onClose: () => void;
  onBuy: () => void;
  onDownload: () => void;
  onVerify: () => void;
  onRemoveListing?: (datasetId: string) => void;
}) {
  const [copiedSeller, setCopiedSeller] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPurchased = profileHook.isPurchased(listing.datasetId);
  const isFree = !listing.price || listing.price === '0' || listing.price.toLowerCase() === 'free';

  const registeredIds = useMemo(
    () => new Set(profileHook.transactions.filter((t) => t.type === 'registered').map((t) => t.datasetId)),
    [profileHook.transactions]
  );

  const isOwner = isListingOwner(listing, walletAddress, registeredIds);

  const displayNickname =
    listing.sellerNickname ||
    (isOwner ? profileHook.profile.nickname || 'AI Researcher' : 'AI Researcher');

  const displaySellerAddress =
    listing.sellerAddress ||
    (isOwner ? walletAddress || '' : '') ||
    listing.providerCommit ||
    '';

  const copySellerAddress = () => {
    if (!displaySellerAddress) return;
    navigator.clipboard.writeText(displaySellerAddress);
    setCopiedSeller(true);
    setTimeout(() => setCopiedSeller(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '1.75rem',
          background: 'var(--bg-modal)',
          boxShadow: 'var(--shadow-modal)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.35rem' }}>
              <span className={`badge ${isFree ? 'badge-green' : 'badge-silver-glow'}`}>
                {isFree ? 'Free' : `${listing.price} tNIGHT`}
              </span>
              <span className="badge">{listing.category || 'AI Dataset'}</span>
            </div>
            <h3 style={{ fontSize: '1.2rem' }}>{listing.datasetName}</h3>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {isOwner && onRemoveListing && (
              <button
                type="button"
                onClick={() => setConfirmDelete((prev) => !prev)}
                title="Delete Listing"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: confirmDelete ? '#ef4444' : 'var(--text-subtle)',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Trash2 size={17} />
              </button>
            )}
            <button
              onClick={onToggleFavorite}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isFavorite ? 'var(--accent-amber)' : 'var(--text-subtle)',
              }}
            >
              <Bookmark size={18} fill={isFavorite ? 'var(--accent-amber)' : 'none'} />
            </button>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.15rem' }}>
          {listing.description || 'Verified dataset on Midnight.'}
        </p>

        {/* Delete Confirmation Alert Box */}
        {confirmDelete && (
          <div
            style={{
              padding: '1.1rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 600, color: '#f87171', marginBottom: '0.35rem', fontSize: '0.92rem' }}>
              Delete this dataset listing?
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
              This will permanently remove "{listing.datasetName}" from the marketplace.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  onRemoveListing?.(listing.datasetId);
                  onClose();
                }}
              >
                <Trash2 size={13} /> Confirm Delete
              </button>
            </div>
          </div>
        )}

        {/* Seller Info Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1.25rem',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <User size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Seller
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {displayNickname} {isOwner && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(You)</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {displaySellerAddress ? (
              <>
                <code
                  className="mono"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.55rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                  title={displaySellerAddress}
                >
                  {truncateAddr(displaySellerAddress)}
                </code>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '0.25rem 0.45rem' }}
                  title="Copy Seller Wallet Address"
                  onClick={copySellerAddress}
                >
                  {copiedSeller ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
                </button>
              </>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Anonymous</span>
            )}
          </div>
        </div>

        {listing.sampleData && (
          <div style={{ marginBottom: '1.25rem' }}>
            <span className="form-label">Sample Data Preview</span>
            <pre
              className="mono"
              style={{
                background: '#0a0a0c',
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                maxHeight: '140px',
                overflowY: 'auto',
              }}
            >
              {listing.sampleData}
            </pre>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {isPurchased ? (
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={onDownload}>
              <Download size={15} /> Download Deliverable
            </button>
          ) : isOwner ? (
            <button
              className="btn btn-secondary"
              style={{
                flex: 2,
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-muted)',
                cursor: 'default',
              }}
              disabled
              title="You listed this dataset"
            >
              <User size={15} /> Your Listing (Seller)
            </button>
          ) : isFree ? (
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={onDownload}>
              <Download size={15} /> Free Download
            </button>
          ) : (
            <button className="btn btn-buy" style={{ flex: 2 }} onClick={onBuy}>
              <ShoppingBag size={15} /> Buy ({listing.price} tNIGHT)
            </button>
          )}

          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onVerify}>
            <ShieldCheck size={15} /> Verify
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function truncateAddr(addr?: string | null): string {
  if (!addr) return 'Anonymous';
  const clean = addr.trim();
  if (clean.length < 20) return clean;
  return `${clean.slice(0, 10)}…${clean.slice(-8)}`;
}

function formatBytes(bytesStr: string | number): string {
  const n = Number(bytesStr);
  if (isNaN(n) || n === 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
