import { useState } from 'react';
import { TOAST_DURATION_MS, TARGET_NETWORK } from './config';
import './index.css';
import { useMidnight, normalizeNetwork } from './hooks/useMidnight';
import { useIndexer } from './hooks/useIndexer';
import { useUserProfile } from './hooks/useUserProfile';
import { useContractBridge } from './hooks/useContractBridge';
import { WalletConnect } from './components/WalletConnect';
import { DatasetExchange } from './components/DatasetExchange';
import { AppLogo } from './components/AppLogo';
import { AvatarIcon } from './components/AvatarIcon';
import {
  ShieldCheck,
  Compass,
  PlusCircle,
  ExternalLink,
  BookOpen,
  Menu,
  X,
  ShoppingBag
} from 'lucide-react';

export type NavSection = 'about' | 'marketplace' | 'register' | 'verifier' | 'profile';

function App() {
  const midnightHook = useMidnight();
  const indexer = useIndexer();
  const [activeSection, setActiveSection] = useState<NavSection>('about');
  const [toast, setToast] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  };

  const walletApi =
    midnightHook.walletState.status === 'connected'
      ? midnightHook.walletState.api
      : null;

  const walletAddress =
    midnightHook.walletState.status === 'connected'
      ? midnightHook.walletState.address
      : null;

  const profileHook = useUserProfile(walletAddress);
  const contractBridge = useContractBridge(walletApi, walletAddress);

  const handleSelectSection = (sec: NavSection) => {
    if (sec === 'profile' && !walletAddress) return;
    setActiveSection(sec);
    setMobileMenuOpen(false);
  };

  const handleDisconnect = () => {
    if (activeSection === 'profile') setActiveSection('about');
    midnightHook.disconnect();
  };

  const isConnected = midnightHook.walletState.status === 'connected';

  const navLinks: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    { id: 'about', label: 'Overview', icon: <Compass size={14} /> },
    { id: 'marketplace', label: 'Marketplace', icon: <ShoppingBag size={14} /> },
    { id: 'register', label: 'List Dataset', icon: <PlusCircle size={14} /> },
    { id: 'verifier', label: 'Verifier', icon: <ShieldCheck size={14} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top Navigation Bar (Apple Frosted Glass) ────────────────────── */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          className="header-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.5rem',
            gap: '1rem',
          }}
        >
          {/* Main Logo & Title */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', flexShrink: 0 }}
            onClick={() => handleSelectSection('about')}
          >
            <AppLogo size={26} />
            <div
              style={{
                fontWeight: 600,
                fontSize: '1.05rem',
                letterSpacing: '-0.02em',
                color: 'var(--text-main)',
              }}
            >
              Nocturne AI DEX
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="header-nav-desktop">
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleSelectSection(link.id)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.84rem',
                    borderRadius: 'var(--radius-full)',
                    background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </button>
              );
            })}

            {/* Profile button */}
            {isConnected && (
              <button
                onClick={() => handleSelectSection('profile')}
                className="btn btn-ghost btn-sm"
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.84rem',
                  borderRadius: 'var(--radius-full)',
                  background: activeSection === 'profile' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeSection === 'profile' ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: activeSection === 'profile' ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <AvatarIcon avatarId={profileHook.profile.avatarId} size={13} />
                <span>Profile</span>
              </button>
            )}
          </nav>

          {/* Right: Wallet & Mobile Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <WalletConnect hook={{ ...midnightHook, disconnect: handleDisconnect }} />

            <button
              type="button"
              className="btn btn-secondary btn-sm mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              style={{ padding: '0.35rem 0.55rem' }}
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              padding: '0.75rem 1.5rem',
              background: '#0a0a0c',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleSelectSection(link.id)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    justifyContent: 'flex-start',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </button>
              );
            })}

            {isConnected && (
              <button
                onClick={() => handleSelectSection('profile')}
                className="btn btn-ghost btn-sm"
                style={{
                  justifyContent: 'flex-start',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: activeSection === 'profile' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeSection === 'profile' ? '#fff' : 'var(--text-muted)',
                  fontWeight: activeSection === 'profile' ? 600 : 400,
                }}
              >
                <AvatarIcon avatarId={profileHook.profile.avatarId} size={14} />
                <span>Profile</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Main Application Content ───────────────────────────────────────── */}
      <main style={{ flex: 1 }}>
        <DatasetExchange
          walletApi={walletApi}
          walletState={midnightHook.walletState}
          onConnect={async (type) => {
            await midnightHook.connect(type);
          }}
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
          registryState={indexer.state}
          indexerLoading={indexer.loading}
          indexerError={indexer.error}
          contractAddress={indexer.contractAddress}
          walletAddress={walletAddress}
          profileHook={profileHook}
          contractBridge={contractBridge}
          onRefresh={() => {
            indexer.refresh();
            contractBridge.refreshProofServer();
            showToast('Marketplace updated');
          }}
          onAddListing={(listing) => {
            const currentNet = midnightHook.walletState.status === 'connected' ? midnightHook.walletState.network : '';
            const isMismatch = !!(
              midnightHook.walletState.status === 'connected' &&
              (midnightHook.walletState.isNetworkMismatch ||
                (currentNet && TARGET_NETWORK && normalizeNetwork(currentNet) !== normalizeNetwork(TARGET_NETWORK)))
            );
            if (isMismatch) {
              showToast(`Listing blocked: wallet is on ${currentNet.toUpperCase()}, target is ${TARGET_NETWORK.toUpperCase()}`);
              return;
            }
            indexer.addOptimisticListing(listing);
            showToast(`Dataset "${listing.datasetName}" listed successfully`);
          }}
          onToggleArchive={(datasetId) => {
            const ok = indexer.toggleArchiveListing(datasetId, walletAddress);
            if (ok) {
              showToast('Listing status updated');
            } else {
              showToast('Unauthorized: Only listing creator can modify this dataset');
            }
          }}
          onRemoveListing={(datasetId) => {
            const ok = indexer.removeListing(datasetId, walletAddress);
            if (ok) {
              showToast('Dataset removed from marketplace');
            } else {
              showToast('Unauthorized: Only listing creator can remove this dataset');
            }
          }}
          onIncrementVerified={() => {
            indexer.incrementVerifiedCount();
            showToast('Integrity proof verified on Midnight');
          }}
          onDeductBalance={(amount, targetAddress) => {
            midnightHook.deductBalance(amount, targetAddress);
          }}
          onCreditBalance={(amount, targetAddress) => {
            midnightHook.creditBalance(amount, targetAddress);
          }}
          onSignAndSubmitPurchaseTx={midnightHook.signAndSubmitPurchaseTx}
          onRefreshBalance={() => {
            midnightHook.refreshBalance();
          }}
          laceIcon={midnightHook.laceIcon}
          oneAmIcon={midnightHook.oneAmIcon}
        />
      </main>

      {/* ── Toast Notification ────────────────────────────────────────────── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            background: '#18181c',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-full)',
            padding: '0.65rem 1.15rem',
            color: '#f5f5f7',
            fontSize: '0.84rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ShieldCheck size={16} color="var(--accent-emerald)" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '1.75rem 1.5rem',
          background: '#000000',
          fontSize: '0.82rem',
          color: 'var(--text-subtle)',
        }}
      >
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AppLogo size={20} />
              <span>
                <strong>Nocturne AI DEX</strong> · Confidential Privacy-Preserving AI Dataset Marketplace
              </span>
            </div>

            {/* Proof Server Status Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.74rem',
                fontWeight: 500,
                padding: '0.22rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                background: contractBridge.proofServerOnline
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(255, 255, 255, 0.04)',
                border: contractBridge.proofServerOnline
                  ? '1px solid rgba(255, 255, 255, 0.2)'
                  : '1px solid var(--border-subtle)',
                color: contractBridge.proofServerOnline ? '#ffffff' : 'var(--text-muted)',
              }}
              title={contractBridge.proofServerOnline ? 'Proof server connected' : 'Proof server offline — local cryptographic fallback active'}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: contractBridge.proofServerOnline ? '#ffffff' : '#e5a950',
                  boxShadow: contractBridge.proofServerOnline
                    ? '0 0 6px rgba(255, 255, 255, 0.8)'
                    : 'none',
                }}
              />
              <span>Proof Server: {contractBridge.proofServerOnline ? 'Online' : 'Offline (Local Anchor Mode)'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://midnight.network"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <span>Midnight Network</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="https://docs.midnight.network"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <span>Docs</span>
              <BookOpen size={11} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
