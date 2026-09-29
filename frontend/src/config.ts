// config.ts
// Central configuration for the Nocturne AI frontend.
//
// All environment variables and shared constants live here.
// Import from this module — do NOT inline env lookups or magic numbers elsewhere.

// ─── Network ────────────────────────────────────────────────────────────────

if (!import.meta.env.VITE_NETWORK) {
  console.warn(
    '[config] VITE_NETWORK is not set. Falling back to "preprod". ' +
    'Set VITE_NETWORK in your .env.local file to suppress this warning.',
  );
}

/** The Midnight network this frontend targets. Override via VITE_NETWORK. */
export const TARGET_NETWORK: string =
  (import.meta.env.VITE_NETWORK as string) || 'preprod';

// ─── Indexer ─────────────────────────────────────────────────────────────────

if (!import.meta.env.VITE_INDEXER_URL) {
  console.warn(
    '[config] VITE_INDEXER_URL is not set. Falling back to the preprod indexer. ' +
    'Set VITE_INDEXER_URL in your .env.local file to suppress this warning.',
  );
}

/** GraphQL endpoint for the Midnight indexer. Override via VITE_INDEXER_URL. */
export const INDEXER_URL: string =
  (import.meta.env.VITE_INDEXER_URL as string) ||
  'https://indexer.preprod.midnight.network/api/v4/graphql';

/** The deployed datasetRegistry contract address. Set via VITE_CONTRACT_ADDRESS. */
export const CONTRACT_ADDRESS: string =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string) ||
  '7def714414d5008a6567f0a8cff655b40e3fe0c08260f7fc1dc2ab139612fe45';

// ─── Proof Server ─────────────────────────────────────────────────────────────

/** Endpoint for the Midnight Proof Server container. Override via VITE_PROOF_SERVER_URL. */
export const PROOF_SERVER_URL: string =
  (import.meta.env.VITE_PROOF_SERVER_URL as string) || 'http://localhost:6300';

// ─── UI Timing Constants ─────────────────────────────────────────────────────

/**
 * Progressive delays (ms) used when probing for injected wallet extensions
 * on page load. Extensions may inject asynchronously after DOMContentLoaded.
 */
export const WALLET_DETECT_DELAYS: readonly number[] = [300, 1000, 2500] as const;

/** How often (ms) the indexer state is polled for on-chain updates. */
export const INDEXER_POLL_MS = 20_000;

/** Fetch timeout (ms) for a single indexer GraphQL request. */
export const INDEXER_FETCH_TIMEOUT_MS = 6_000;

/**
 * Artificial delay (ms) before the ZK on-chain proof animation resolves,
 * giving the UI time to show the in-progress state before flipping to success.
 */
export const ZK_PROOF_ANIMATION_MS = 600;

/**
 * Artificial delay (ms) before the local file-hash check animation resolves,
 * matching the perceived "thinking" time for the SHA-256 computation feedback.
 */
export const FILE_HASH_ANIMATION_MS = 400;

/** Duration (ms) for which toast notifications are shown before auto-dismissal. */
export const TOAST_DURATION_MS = 3_500;

/** Duration (ms) for which the "Copied!" feedback is shown in copy-to-clipboard buttons. */
export const COPY_FEEDBACK_MS = 2_000;
