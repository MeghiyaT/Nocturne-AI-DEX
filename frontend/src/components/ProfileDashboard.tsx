// ProfileDashboard.tsx
// Per-wallet account dashboard for Nocturne AI — My Profile, Purchased Datasets, and My Listings.

import { useState, useEffect } from 'react';
import { COPY_FEEDBACK_MS } from '../config';
import type { RegistryState, DataListing } from '../hooks/useIndexer';
import type { UserProfileHook, PurchaseRecord } from '../hooks/useUserProfile';
import type { NavSection } from '../App';
import { AvatarIcon, AVATAR_OPTIONS } from './AvatarIcon';
import { ConfirmModal } from './ConfirmModal';
import { isListingOwner } from '../utils/datasetUtils';
import {
  User,
  Database,
  Copy,
  Check,
  Edit2,
  Archive,
  RotateCcw,
  Trash2,
  ShieldCheck,
  PlusCircle,
  ShoppingBag,
  Download,
  X,
  Sparkles
} from 'lucide-react';

interface Props {
  walletAddress: string;
  profileHook: UserProfileHook;
  registryState: RegistryState;
  onSelectSection: (sec: NavSection) => void;
  onToggleArchive?: (datasetId: string) => void;
  onRemoveListing?: (datasetId: string) => void;
  onVerifyAcquisition?: (listing: DataListing, payload?: string) => void;
}

type Tab = 'profile' | 'purchases' | 'listings' | 'archived';

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 20) return addr;
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`;
}

export function ProfileDashboard({
  walletAddress,
  profileHook,
  registryState,
  onSelectSection,
  onToggleArchive,
  onRemoveListing,
  onVerifyAcquisition,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(profileHook.profile.nickname);
  const [bioInput, setBioInput] = useState(profileHook.profile.bio);
  const [bioSavedFeedback, setBioSavedFeedback] = useState(false);
  const [copied, setCopied] = useState(false);
  const [datasetToRemove, setDatasetToRemove] = useState<DataListing | null>(null);
  const [purchaseToRemove, setPurchaseToRemove] = useState<PurchaseRecord | null>(null);

  const { profile, purchases, sales, updateProfile } = profileHook;

  // Sync inputs when profile changes
  useEffect(() => {
    setNicknameInput(profile.nickname);
    setBioInput(profile.bio);
  }, [profile.nickname, profile.bio]);

  // Datasets listed by connected wallet
  const registeredIds = new Set(
    profileHook.transactions
      .filter((t) => t.type === 'registered')
      .map((t) => t.datasetId)
  );

  const myListings = registryState.listings.filter((l) =>
    isListingOwner(l, walletAddress, registeredIds)
  );

  const activeListings = myListings.filter((l) => l.isActive !== false);
  const archivedListings = myListings.filter((l) => l.isActive === false);

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.price || 0), 0);

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  const saveNickname = () => {
    updateProfile({ nickname: nicknameInput.trim() });
    setEditingNickname(false);
  };

  const saveBio = () => {
    updateProfile({ bio: bioInput.trim() });
    setBioSavedFeedback(true);
    setTimeout(() => setBioSavedFeedback(false), 2000);
  };

  const isBioDirty = bioInput !== profile.bio;

  const handleDownloadPurchase = (p: PurchaseRecord) => {
    const payload = p.downloadPayload || `Dataset: ${p.datasetName}\nID: ${p.datasetId}`;
    const filename = `${p.datasetName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.${p.format || 'csv'}`;
    const blob = new Blob([payload], { type: p.format === 'json' ? 'application/json' : 'text/csv' });
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
    <div style={{ padding: '2.5rem 0 4rem 0' }}>
      <div className="container" style={{ maxWidth: '820px' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={14} /> My Profile
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('purchases')}
          >
            <ShoppingBag size={14} /> Purchased Datasets ({purchases.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'listings' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('listings')}
          >
            <Database size={14} /> My Listings ({activeListings.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'archived' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('archived')}
          >
            <Archive size={14} /> Archived ({archivedListings.length})
          </button>
        </div>

        {/* ── TAB 1: MY PROFILE ────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Avatar Icon Column */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  onClick={() => setShowAvatarPicker(true)}
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1.5px solid rgba(255, 255, 255, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                  }}
                  title="Click to choose profile avatar"
                >
                  <AvatarIcon avatarId={profile.avatarId} size={38} />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem', color: 'var(--text-muted)' }}
                  onClick={() => setShowAvatarPicker(true)}
                >
                  Change Icon
                </button>
              </div>

              {/* Profile Details Column */}
              <div style={{ flex: 1, minWidth: '260px' }}>
                {/* Single Nickname Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {editingNickname ? (
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '1rem', height: '36px' }}
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        placeholder="Enter nickname..."
                        autoFocus
                      />
                      <button className="btn btn-primary btn-sm" onClick={saveNickname}>
                        Save
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingNickname(false)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)' }}>
                        {profile.nickname || 'AI Researcher'}
                      </h2>
                      <button
                        onClick={() => setEditingNickname(true)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: '0.2rem' }}
                        title="Edit nickname"
                      >
                        <Edit2 size={15} />
                      </button>
                    </>
                  )}
                </div>

                {/* Wallet Address Box */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Connected Wallet Address</label>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.6rem 0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span className="mono" style={{ color: 'var(--text-main)' }}>{truncateAddr(walletAddress)}</span>
                    <button
                      onClick={copyAddress}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copied ? 'var(--accent-emerald)' : 'var(--text-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      title="Copy full address"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span style={{ fontSize: '0.72rem' }}>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Bio Textarea */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Bio / Research Focus</label>
                    {bioSavedFeedback && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Check size={12} /> Saved
                      </span>
                    )}
                  </div>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={bioInput}
                    onChange={(e) => setBioInput(e.target.value)}
                    onBlur={() => {
                      if (isBioDirty) saveBio();
                    }}
                    placeholder="Describe your research focus or dataset catalog..."
                  />
                  {isBioDirty && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={saveBio}>
                        Save Bio
                      </button>
                    </div>
                  )}
                </div>

                {/* Overview Metrics Bar (Monochromatic Theme) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'block', letterSpacing: '0.04em' }}>ACQUIRED</span>
                    <strong style={{ fontSize: '1.1rem', color: '#ffffff' }}>{purchases.length}</strong>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'block', letterSpacing: '0.04em' }}>LISTINGS</span>
                    <strong style={{ fontSize: '1.1rem', color: '#ffffff' }}>{myListings.length}</strong>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'block', letterSpacing: '0.04em' }}>REVENUE</span>
                    <strong style={{ fontSize: '1.1rem', color: '#ffffff' }}>
                      {totalRevenue}{' '}
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>tNIGHT</span>
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: PURCHASED DATASETS ────────────────────────────────────── */}
        {activeTab === 'purchases' && (
          <div>
            {purchases.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
                <ShoppingBag size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.35 }} />
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>No datasets acquired</h3>
                <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Datasets you purchase on the marketplace will appear here for instant deliverable downloads.
                </p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onSelectSection('marketplace')}
                >
                  Explore Marketplace
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {purchases.map((p) => {
                  const matchedListing = registryState.listings.find((l) => l.datasetId === p.datasetId);
                  return (
                    <div
                      key={p.id}
                      className="card"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        padding: '1.15rem 1.35rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.25rem' }}>
                          <span className="badge badge-green">Purchased</span>
                          <span className={`badge ${p.price && p.price !== '0' ? 'badge-silver-glow' : 'badge-green'}`}>
                            {p.price} {p.currency}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1rem' }}>{p.datasetName}</h4>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                          {new Date(p.purchaseDate).toLocaleDateString()} · Tx:{' '}
                          <code className="mono">{p.receiptHash.slice(0, 8)}…{p.receiptHash.slice(-6)}</code>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDownloadPurchase(p)}
                        >
                          <Download size={13} /> Download
                        </button>
                        {onVerifyAcquisition && matchedListing && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onVerifyAcquisition(matchedListing, p.downloadPayload)}
                          >
                            <ShieldCheck size={13} /> Verify
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--accent-rose)' }}
                          onClick={() => setPurchaseToRemove(p)}
                          title="Delete purchase record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: MY LISTINGS (ACTIVE) ─────────────────────────────────── */}
        {activeTab === 'listings' && (
          <div>
            {activeListings.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
                <Database size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.35 }} />
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>No active datasets</h3>
                <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  {archivedListings.length > 0
                    ? `You have ${archivedListings.length} archived dataset${archivedListings.length > 1 ? 's' : ''}.`
                    : 'List and monetize your AI datasets with on-chain cryptographic anchors.'}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onSelectSection('register')}
                  >
                    <PlusCircle size={13} /> List a Dataset
                  </button>
                  {archivedListings.length > 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveTab('archived')}
                    >
                      <Archive size={13} /> View Archived ({archivedListings.length})
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {activeListings.map((l) => (
                  <div
                    key={l.datasetId}
                    className="card"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      padding: '1.15rem 1.35rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.25rem' }}>
                        <span className={`badge ${l.price && l.price !== '0' ? 'badge-silver-glow' : 'badge-green'}`}>
                          {l.price && l.price !== '0' ? `${l.price} tNIGHT` : 'Free'}
                        </span>
                        <span className="badge badge-green">
                          Active on Marketplace
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1rem' }}>{l.datasetName}</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                        {l.rowCount || 'Custom'} · {l.license}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {onToggleArchive && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onToggleArchive(l.datasetId)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          title="Archive this dataset (removes from public marketplace)"
                        >
                          <Archive size={13} />
                          <span>Archive</span>
                        </button>
                      )}
                      {onRemoveListing && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--accent-rose)' }}
                          onClick={() => setDatasetToRemove(l)}
                          title="Delete dataset"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: ARCHIVED DATASETS ──────────────────────────────────────── */}
        {activeTab === 'archived' && (
          <div>
            {archivedListings.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
                <Archive size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.35 }} />
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>No archived datasets</h3>
                <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Datasets you archive from the marketplace will appear here. You can restore them to the public marketplace anytime.
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('listings')}
                >
                  <Database size={13} /> View Active Listings ({activeListings.length})
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem 0.2rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Archived datasets are hidden from public buyers on the marketplace. Click <strong>Restore</strong> to reactivate.
                </div>
                {archivedListings.map((l) => (
                  <div
                    key={l.datasetId}
                    className="card"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      padding: '1.15rem 1.35rem',
                      opacity: 0.9,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.25rem' }}>
                        <span className={`badge ${l.price && l.price !== '0' ? 'badge-silver-glow' : 'badge-green'}`}>
                          {l.price && l.price !== '0' ? `${l.price} tNIGHT` : 'Free'}
                        </span>
                        <span className="badge badge-subtle">
                          Archived (Hidden)
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1rem' }}>{l.datasetName}</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                        {l.rowCount || 'Custom'} · {l.license}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {onToggleArchive && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onToggleArchive(l.datasetId)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          title="Restore dataset to public marketplace"
                        >
                          <RotateCcw size={13} />
                          <span>Restore</span>
                        </button>
                      )}
                      {onRemoveListing && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--accent-rose)' }}
                          onClick={() => setDatasetToRemove(l)}
                          title="Delete dataset"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Sleek Avatar Selector Modal ─────────────────────────────────── */}
        {showAvatarPicker && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}
            onClick={() => setShowAvatarPicker(false)}
          >
            <div
              className="card"
              style={{
                maxWidth: '440px',
                width: '100%',
                background: '#0d0d12',
                border: '1px solid var(--border-glass)',
                padding: '1.75rem',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={16} />
                  <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-main)' }}>Select Profile Avatar</h3>
                </div>
                <button
                  onClick={() => setShowAvatarPicker(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.65rem',
                  marginBottom: '1.5rem',
                }}
              >
                {AVATAR_OPTIONS.map((item) => {
                  const isSelected = (profile.avatarId || 'fingerprint').toLowerCase() === item.id.toLowerCase();
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        updateProfile({ avatarId: item.id });
                        setShowAvatarPicker(false);
                      }}
                      style={{
                        background: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? '1.5px solid #ffffff' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem 0.4rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isSelected ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AvatarIcon avatarId={item.id} size={17} />
                      </div>
                      <span style={{ fontSize: '0.66rem', fontWeight: isSelected ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => setShowAvatarPicker(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {datasetToRemove && (
          <ConfirmModal
            isOpen={true}
            title="Remove Listing"
            message={`Are you sure you want to remove "${datasetToRemove.datasetName}" from the marketplace?`}
            onConfirm={() => {
              if (onRemoveListing) onRemoveListing(datasetToRemove.datasetId);
              setDatasetToRemove(null);
            }}
            onCancel={() => setDatasetToRemove(null)}
          />
        )}

        {purchaseToRemove && (
          <ConfirmModal
            isOpen={true}
            title="Delete Purchase Record"
            message={`Are you sure you want to remove "${purchaseToRemove.datasetName}" from your purchased datasets list?`}
            onConfirm={() => {
              profileHook.removePurchase(purchaseToRemove.id);
              setPurchaseToRemove(null);
            }}
            onCancel={() => setPurchaseToRemove(null)}
          />
        )}
      </div>
    </div>
  );
}
