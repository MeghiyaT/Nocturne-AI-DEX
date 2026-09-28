// Pure helpers for shaping "datasets" into what the contract consumes.
//
// The contract registers a dataset as Vector<16, Bytes<32>>: exactly 16 slices
// of 32 bytes each (512 bytes total). A real training dataset is far larger, so
// we reduce each slice to a deterministic hash of one of 16 chunks of the file.
// The on-chain dataCommitment is then a commitment to the WHOLE file, and
// proveIntegrity proves you still hold the same file — without exposing it.
//
// This module is dependency-free (only node:crypto) so it stays unit-testable.

import { createHash } from 'node:crypto';

export const SLICE_COUNT = 16 as const;
export const SLICE_BYTES = 32 as const;

// Split the file into exactly `count` contiguous chunks (0-padded slices for
// files shorter than `count` bytes).
export function chunkBytes(content: Uint8Array, count: number): Uint8Array[] {
  if (count <= 0) throw new Error('chunk count must be positive');
  const n = content.length;
  if (n === 0) return Array.from({ length: count }, () => new Uint8Array(0));
  const startChunk = Math.max(1, Math.ceil(n / count));
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const s = i * startChunk;
    const e = Math.min(n, s + startChunk);
    chunks.push(s >= n ? new Uint8Array(0) : content.slice(s, e));
  }
  return chunks;
}

export function sha256(input: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(input).digest());
}

export function sha256Hex(input: Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

// 16 x 32-byte slices from raw bytes: hash of each chunk, zero-padded to 16.
export function datasetSlicesFromBytes(content: Uint8Array): Uint8Array[] {
  if (content.length === 0) {
    throw new Error('Cannot compute dataset slices from empty content');
  }
  const chunks = chunkBytes(content, SLICE_COUNT);
  const slices = chunks.map((c) => {
    const h = sha256(c);
    if (h.length === SLICE_BYTES) return h;
    const padded = new Uint8Array(SLICE_BYTES);
    padded.set(h.subarray(0, SLICE_BYTES));
    return padded;
  });
  return slices;
}

// Deterministic 32-byte dataset ID from a human label.
export function datasetIdFromLabel(label: string): Uint8Array {
  return sha256(new Uint8Array(Buffer.from(label, 'utf-8')));
}

export function bytes32ToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function hexToBytes32(hex: string): Uint8Array {
  const clean = String(hex).replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error(`expected a 32-byte hex string (64 hex chars), got: ${hex}`);
  }
  return new Uint8Array(Buffer.from(clean, 'hex'));
}

export type SliceProvider = (datasetId: Uint8Array) => Promise<Uint8Array[]>;

// In-memory store keyed by dataset-id hex so the same file can be re-proven
// in later runs of a session.
export class DatasetStore {
  private readonly slicesByHex = new Map<string, Uint8Array[]>();

  set(datasetId: Uint8Array, slices: Uint8Array[]): void {
    this.slicesByHex.set(bytes32ToHex(datasetId), slices);
  }

  get(datasetId: Uint8Array): Uint8Array[] | undefined {
    return this.slicesByHex.get(bytes32ToHex(datasetId));
  }

  has(datasetId: Uint8Array): boolean {
    return this.slicesByHex.has(bytes32ToHex(datasetId));
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

export const datasetStoreToSliceProvider = (store: DatasetStore): SliceProvider =>
  async (datasetId: Uint8Array): Promise<Uint8Array[]> => {
    const slices = store.get(datasetId);
    if (!slices || slices.length === 0) {
      const idHex = Array.from(datasetId)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16);
      throw new Error(
        `No dataset slices found for id ${idHex}… ` +
          'Call store.set(id, slices) before invoking the circuit, ' +
          'or pass --file to load them from disk.',
      );
    }
    return slices;
  };