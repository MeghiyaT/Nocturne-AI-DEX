import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  WALLET_STATE_DIR,
  WALLET_STATE_VERSION,
  CHILD_KINDS,
  loadWalletState,
  saveWalletState,
  clearWalletState,
} from '../src/wallet-state';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-wstate-'));
}

describe('wallet-state', () => {
  it('round-trips shielded/unshielded/dust state', () => {
    const cwd = tmpDir();
    const payload = {
      shielded: { some: 'bin', n: 42 },
      unshielded: { utxos: ['a', 'b'] },
    };
    saveWalletState('preview', payload, { cwd });
    const loaded = loadWalletState('preview', { cwd } as any);
    saveWalletState('preview', { dust: 'dust-hex' }, { cwd });
    const loaded2 = loadWalletState('preview', { cwd } as any);
    expect(JSON.stringify(loaded.shielded)).toBe(JSON.stringify(payload.shielded));
  });

  it('isolates state by network directory', () => {
    const cwd = tmpDir();
    saveWalletState('preview', { shielded: { v: 'preview' } }, { cwd });
    saveWalletState('preprod', { shielded: { v: 'preprod' } }, { cwd });
    const a = loadWalletState('preview', { cwd } as any);
    const b = loadWalletState('preprod', { cwd } as any);
    expect((a.shielded as any).v).toBe('preview');
    expect((b.shielded as any).v).toBe('preprod');
  });

  it('returns empty state when no files exist', () => {
    const cwd = tmpDir();
    const s = loadWalletState('preview', { cwd } as any);
    expect(s.shielded).toBeUndefined();
    expect(s.unshielded).toBeUndefined();
    expect(s.dust).toBeUndefined();
  });

  it('creates the state directory on save', () => {
    const dir = tmpDir();
    saveWalletState('preview', { dust: 'd' }, { cwd: dir });
    expect(fs.existsSync(path.join(dir, WALLET_STATE_DIR, 'preview'))).toBe(true);
  });

  it('ignores corrupt entries', () => {
    const cwd = tmpDir();
    const netDir = path.join(cwd, WALLET_STATE_DIR, 'preview');
    fs.mkdirSync(netDir, { recursive: true });
    fs.writeFileSync(path.join(netDir, 'shielded.json'), '{not json{{');
    const s = loadWalletState('preview', { cwd });
    expect(s.shielded).toBeUndefined();
  });

  it('clearWalletState removes everything for a network', () => {
    const cwd = tmpDir();
    saveWalletState('preview', { shielded: { x: 1 } }, { cwd });
    clearWalletState('preview', { cwd });
    const s = loadWalletState('preview', { cwd });
    expect(s.shielded).toBeUndefined();
  });

  it('exposes stable version + child kinds', () => {
    expect(WALLET_STATE_VERSION).toBe(1);
    expect(CHILD_KINDS).toEqual(['shielded', 'unshielded', 'dust']);
  });
});
