// datasetUtils.ts
// Browser-compatible port of src/dataset.ts for the Nocturne AI frontend.
//
// The Compact contract's witnesses require datasets as Vector<16, Bytes<32>>:
// exactly 16 slices of 32 bytes each. This module replicates the Node.js
// slicing algorithm using only browser-native crypto.subtle APIs.
//
// ─── Zero external dependencies ──────────────────────────────────────────────

export const SLICE_COUNT = 16 as const;
export const SLICE_BYTES = 32 as const;

// ─── SHA-256 (browser) ──────────────────────────────────────────────────────

/** Compute SHA-256 hash of a Uint8Array using browser crypto.subtle. */
export async function sha256Browser(input: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', input as unknown as BufferSource);
  return new Uint8Array(hashBuffer);
}

/** Compute SHA-256 and return as hex string. */
export async function sha256HexBrowser(input: Uint8Array): Promise<string> {
  const hash = await sha256Browser(input);
  return bytes32ToHex(hash);
}

// ─── Chunking ───────────────────────────────────────────────────────────────

/**
 * Split content into exactly `count` contiguous chunks.
 * Mirrors the Node.js chunkBytes() from src/dataset.ts exactly.
 */
export function chunkBytesBrowser(content: Uint8Array, count: number): Uint8Array[] {
  if (count <= 0) throw new Error('chunk count must be positive');
  const n = content.length;
  if (n === 0) return Array.from({ length: count }, () => new Uint8Array(0));
  const chunkSize = Math.max(1, Math.ceil(n / count));
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const s = i * chunkSize;
    const e = Math.min(n, s + chunkSize);
    chunks.push(s >= n ? new Uint8Array(0) : content.slice(s, e));
  }
  return chunks;
}

// ─── Dataset Slicing ────────────────────────────────────────────────────────

/**
 * Produce the 16 × 32-byte slices the contract witness expects.
 * Each slice is the SHA-256 of one of 16 contiguous chunks of the file.
 *
 * This MUST produce identical output to src/dataset.ts:datasetSlicesFromBytes
 * for the same input, so that on-chain commitments match.
 */
export async function datasetSlicesFromBytesBrowser(
  content: Uint8Array,
): Promise<Uint8Array[]> {
  const chunks = chunkBytesBrowser(content, SLICE_COUNT);
  const slices = await Promise.all(
    chunks.map(async (chunk) => {
      const hash = await sha256Browser(chunk);
      if (hash.length === SLICE_BYTES) return hash;
      // Pad/truncate to exactly 32 bytes (SHA-256 always returns 32, but safety)
      const padded = new Uint8Array(SLICE_BYTES);
      padded.set(hash.subarray(0, SLICE_BYTES));
      return padded;
    }),
  );
  return slices;
}

/**
 * Deterministic 32-byte dataset ID from a human-readable label.
 * Matches src/dataset.ts:datasetIdFromLabel exactly.
 */
export async function datasetIdFromLabelBrowser(label: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  return sha256Browser(encoder.encode(label));
}

// ─── Hex Conversion Utilities ───────────────────────────────────────────────

/** Convert a Uint8Array to a lowercase hex string (no 0x prefix). */
export function bytes32ToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Convert a hex string (with or without 0x prefix) to a Uint8Array. */
export function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error(`expected a 32-byte hex string (64 hex chars), got: ${hex}`);
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

// ─── Provider Secret Derivation (Browser) ───────────────────────────────────

/**
 * Derive a 32-byte providerSecret from the wallet address.
 *
 * In the CLI backend, providerSecret is derived from the wallet seed.
 * In the browser we cannot access the seed, so we derive from the wallet
 * address instead. This means browser-registered datasets will have a
 * different providerCommit than CLI-registered ones — this is the correct
 * security trade-off.
 */
export async function deriveProviderSecretBrowser(walletAddress: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const input = encoder.encode(`nocturne:browser:provider:${walletAddress}`);
  return sha256Browser(input);
}

// ─── In-Memory Slice Store ──────────────────────────────────────────────────

/**
 * Browser-side in-memory store for dataset slices.
 * Keyed by dataset-ID hex so the same file can be re-verified
 * within a browser session without re-uploading.
 */
export class BrowserDatasetStore {
  private readonly slicesByHex = new Map<string, Uint8Array[]>();

  set(datasetId: Uint8Array, slices: Uint8Array[]): void {
    this.slicesByHex.set(bytes32ToHex(datasetId), slices);
  }

  get(datasetId: Uint8Array | string): Uint8Array[] | undefined {
    const key = typeof datasetId === 'string'
      ? datasetId.replace(/^0x/, '')
      : bytes32ToHex(datasetId);
    return this.slicesByHex.get(key);
  }

  has(datasetId: Uint8Array | string): boolean {
    const key = typeof datasetId === 'string'
      ? datasetId.replace(/^0x/, '')
      : bytes32ToHex(datasetId);
    return this.slicesByHex.has(key);
  }

  delete(datasetId: Uint8Array): void {
    this.slicesByHex.delete(bytes32ToHex(datasetId));
  }

  clear(): void {
    this.slicesByHex.clear();
  }

  size(): number {
    return this.slicesByHex.size;
  }
}
