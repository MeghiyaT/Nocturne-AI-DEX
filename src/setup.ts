// One-shot setup: compile contract if needed, ensure proof server is up, then
// deploy to the active network. Non-interactive.
import { WebSocket } from 'ws';
import { pathToFileURL } from 'node:url';
import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice } from './network';
import { ensureContractCompiled } from './contract-client';
import { deploy } from './deploy';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

/** How long (ms) to pause between proof-server reachability probes. */
const PROOF_SERVER_RETRY_MS = 2_000;

async function waitForProofServer(url: string, maxMs = 120_000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  process.stdout.write(`  Waiting for proof server at ${url} ...  `);
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(3000) });
      process.stdout.write('ready\n');
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, PROOF_SERVER_RETRY_MS));
      process.stdout.write('.');
    }
  }
  process.stdout.write('\n');
  return false;
}

export async function setup(): Promise<void> {
  console.log('─── Nocturne AI setup ──────────────────────────────────\n');

  const { network, config } = resolveNetwork();
  const wallet = getOrCreateWallet(network);
  console.log(`  Active network: ${network}`);
  const notice = formatWalletBackupNotice(wallet, network);
  if (notice) console.log(notice);

  // 1. contract must exist
  try {
    ensureContractCompiled();
    console.log('  Contract: compiled artifacts present ✔\n');
  } catch {
    console.log('  Contract artifacts missing — run `npm run compile` first, or I will try now.');
    await compileNow();
  }

  // 2. proof server must be reachable  (docker compose recommended)
  const up = await waitForProofServer(config.proofServer);
  if (!up) {
    console.log('\n  ❌ Proof server not reachable. Start it with:');
    console.log('       docker compose up -d');
    console.log('  Aborting setup (wallet is safe to reuse).\n');
    process.exit(1);
  }
  console.log('');

  // 3. deploy
  await deploy();
}

async function compileNow(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const { spawn } = require('node:child_process');
    const child = spawn('npm', ['run', 'compile'], { cwd: process.cwd(), stdio: 'inherit' });
    child.on('exit', (code: number) => (code === 0 ? resolve() : reject(new Error(`compile exited ${code}`))));
  });
}

const SELF = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (SELF) {
  setup().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
