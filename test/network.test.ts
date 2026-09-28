import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as core from 'node:buffer';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isNetworkId,
  parseNetworkFlag,
  resolveNetwork,
  getOrCreateWallet,
  getOrCreateSeed,
  isValidMnemonic,
  generateMnemonicPhrase,
  normalizeMnemonic,
  NETWORK_CONFIGS,
  STATE_FILE_NAME,
  recordDeployment,
  getDeployment,
  setActiveNetwork,
  loadState,
  GENESIS_SEED,
} from '../src/network';

describe('isNetworkId', () => {
  it('accepts the three supported networks', () => {
    expect(isNetworkId('undeployed')).toBe(true);
    expect(isNetworkId('preview')).toBe(true);
    expect(isNetworkId('preprod')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isNetworkId('mainnet')).toBe(false);
    expect(isNetworkId(undefined)).toBe(false);
    expect(isNetworkId(42)).toBe(false);
  });
});

describe('parseNetworkFlag', () => {
  it('reads --network value', () => {
    expect(parseNetworkFlag(['node', 'script', '--network', 'preview'])).toBe('preview');
  });
  it('reads --network=value', () => {
    expect(parseNetworkFlag(['node', 'script', '--network=preprod'])).toBe('preprod');
  });
  it('returns null when absent', () => {
    expect(parseNetworkFlag(['node', 'script'])).toBeNull();
  });
  it('throws on unknown network', () => {
    expect(() => parseNetworkFlag(['node', 'script', '--network', 'bogus'])).toThrow();
  });
  it('throws on missing value', () => {
    expect(() => parseNetworkFlag(['node', 'script', '--network'])).toThrow();
  });
});

describe('resolveNetwork', () => {
  it('defaults to undeployed when no state exists', () => {
    const r = resolveNetwork({ argv: ['node', 'x'], cwd: os.tmpdir(), env: {} });
    expect(r.network).toBe('undeployed');
    expect(r.source).toBe('default');
  });
  it('flag wins over state', () => {
    const tmp = mkTmp();
    setActiveNetwork('preview', { cwd: tmp });
    const r = resolveNetwork({ argv: ['node', 'x', '--network=preprod'], cwd: tmp, env: {} });
    expect(r.network).toBe('preprod');
    expect(r.source).toBe('flag');
  });
  it('falls back to saved active network', () => {
    const tmp = mkTmp(null);
    setActiveNetwork('preprod', { cwd: tmp });
    const r = resolveNetwork({ argv: ['node', 'x'], cwd: tmp, env: {} });
    expect(r.network).toBe('preprod');
    expect(r.source).toBe('state');
  });
  it('applies env overrides', () => {
    const tmp = mkTmp(null);
    const r = resolveNetwork({
      argv: ['node', 'x'],
      cwd: tmp,
      env: { MIDNIGHT_INDEXER_URL: 'http://override' },
    });
    expect(r.config.indexer).toBe('http://override');
  });
  it('has key endpoints for each network', () => {
    expect(NETWORK_CONFIGS.preview.indexer).toMatch(/^https:\/\//);
    expect(NETWORK_CONFIGS.undeployed.node).toMatch(/9944/);
    expect(NETWORK_CONFIGS.preprod.faucet).not.toBeNull();
  });
});

describe('wallet identity', () => {
  it('generates a valid 24-word BIP-39 mnemonic', () => {
    const m = generateMnemonicPhrase();
    expect(m.split(' ')).toHaveLength(24);
    expect(isValidMnemonic(m)).toBe(true);
  });
  it('normalizes whitespace/case', () => {
    expect(normalizeMnemonic('  AbB  cdd \t EE ')).toBe('abb cdd ee');
  });
  it('rejects bad mnemonics', () => {
    expect(isValidMnemonic('not a real phrase')).toBe(false);
  });
  it('writes a fresh seed and re-reads it', () => {
    const cwd = mkTmp(null);
    const a = getOrCreateSeed('preview', { cwd });
    const b = getOrCreateSeed('preview', { cwd });
    expect(a).toEqual(b);
    expect(a.length).toBe(128); // 64 bytes hex (PBKDF2 BIP-39 seed)
    const rawB = Buffer.from(b, 'hex').length;
    expect(rawB).toBe(64);
  });
  it('uses the genesis seed on undeployed', () => {
    expect(getOrCreateSeed('undeployed')).toBe(GENESIS_SEED);
  });
  it('accepts an env-provided seed', () => {
    const seed = 'ab'.repeat(32);
    const w = getOrCreateSeed('preview', { cwd: mkTmp(null), env: { MIDNIGHT_WALLET_SEED: seed } });
    expect(w).toBe(seed);
  });
  it('rejects a short env seed', () => {
    expect(() => getOrCreateSeed('preview', { cwd: mkTmp(null), env: { MIDNIGHT_WALLET_SEED: 'abcd' } })).toThrow();
  });
  it('refuses both env seed and mnemonic', () => {
    expect(() =>
      getOrCreateSeed('preview', {
        cwd: mkTmp(null),
        env: { MIDNIGHT_WALLET_SEED: 'ab'.repeat(32), MIDNIGHT_WALLET_MNEMONIC: generateMnemonicPhrase() },
      }),
    ).toThrow();
  });
});

describe('deployment records', () => {
  it('records and reads back a deployment with versioned state', () => {
    const cwd = mkTmp(null);
    const addr = 'midnight-contract-placeholder-addr';
    recordNetwork(cwd, addr);
    const dep = getDeployment('preview', { cwd });
    expect(dep?.address).toBe(addr);
    expect(dep?.deployer).toMatch(/^0x/);
    const state = loadState({ cwd });
    expect(state?.activeNetwork).toBe('preview');
  });
});

function mkTmp(base?: string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-test-'));
  if (base) fs.mkdirSync(path.join(dir, base), { recursive: true });
  return dir;
}

function recordNetwork(cwd: string, addr: string): void {
  setActiveNetwork('preview', { cwd });
  recordDeployment('preview', addr, '0x0000000000000000000000000000000000000000', { cwd });
}
