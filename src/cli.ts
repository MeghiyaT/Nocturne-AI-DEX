// Interactive CLI for the Nocturne AI registry.
//
// Commands (operate on the active network's deployed contract):
//   register <label> <name> <size> <rows> <license> [--file path]
//   list
//   prove <label> [--file path]
//   set-active <label> <on|off>
//   row-count <label>
//
// Reads the deployed address from .midnight-state.json. Owner-only operations
// require the wallet that deployed the contract (same seed).
import './polyfills';
import { pathToFileURL } from 'node:url';
import * as fs from 'node:fs';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { resolveNetwork, getOrCreateWallet, getDeployment } from './network';
import { createWallet } from './wallet';
import { createProviders, loadCompiledContract, ensureContractCompiled, CONTRACT_PATH } from './contract-client';
import {
  datasetIdFromLabel,
  bytes32ToHex,
  datasetSlicesFromBytes,
  DatasetStore,
  datasetStoreToSliceProvider,
  sha256,
} from './dataset';



const PRIVATE_STATE_ID = 'nocturneState';

export interface CliContext {
  network: string;
  store: DatasetStore;
  walletCtx: any;
  found: any;
  contractAddress: string;
  publicDataProvider: any;
}

function deriveProviderSecret(seed: string): Uint8Array {
  const raw = Buffer.from(seed, 'hex');
  const secret = raw.length >= 32 ? raw.subarray(0, 32) : Buffer.concat([raw, Buffer.alloc(32 - raw.length)]);
  return sha256(new Uint8Array(secret));
}

export function help(): string {
  return [
    'Usage:',
    '  npm run cli -- register <label> <name> <sizeBytes> <rows> <license> [--file <path>]',
    '  npm run cli -- list',
    '  npm run cli -- prove <label> [--file <path>]',
    '  npm run cli -- set-active <label> <on|off>',
    '  npm run cli -- row-count <label>',
    '',
    'Operates on the deployed datasetRegistry for the active network.',
  ].join('\n');
}

export async function connect(): Promise<CliContext> {
  const { network, config: networkConfig } = resolveNetwork();
  const deployment = getDeployment(network);
  if (!deployment) {
    throw new Error(`No deployment recorded for ${network}. Run: npm run setup`);
  }
  const { seed } = getOrCreateWallet(network);

  const store = new DatasetStore();
  const provider = datasetStoreToSliceProvider(store);
  const { compiledContract } = await loadCompiledContract(provider, deriveProviderSecret(seed));

  const walletCtx = await createWallet({ network, networkConfig, seed });
  const providers = createProviders(walletCtx, networkConfig, { privateStateId: PRIVATE_STATE_ID });

  const found = await findDeployedContract(providers, {
    compiledContract,
    contractAddress: deployment.address,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });

  return {
    network,
    store,
    walletCtx,
    found,
    contractAddress: deployment.address,
    publicDataProvider: providers.publicDataProvider,
  };
}

function flagValue(args: string[], name: string): string | null {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

export async function listDatasets(ctx: CliContext): Promise<Array<Record<string, unknown>>> {
  const source = (await import(pathToFileURL(CONTRACT_PATH).href)) as any;
  const ledger = source.ledger;
  const raw = await ctx.publicDataProvider.queryContractState(ctx.contractAddress);
  if (!raw) {
    console.log('  (no public state found yet — indexer may need a moment)');
    return [];
  }
  const decoded = ledger(raw.data);
  console.log(`  ownerId:   ${bytes32ToHex(decoded.ownerCommit).slice(0, 16)}…`);
  console.log(`  verifiedCount: ${decoded.verifiedCount}`);
  console.log('');
  const rows: Array<Record<string, unknown>> = [];
  for (const [id, listing] of decoded.registry) {
    rows.push({
      id: bytes32ToHex(id).slice(0, 16) + '…',
      name: listing.datasetName,
      category: listing.category,
      size: listing.datasetSize.toString(),
      rows: listing.rowCount,
      license: listing.license,
      active: listing.isActive,
    });
  }
  if (rows.length === 0) {
    console.log('  (registry is empty)');
  } else {
    console.table(rows);
  }
  return rows;
}

export interface RegisterOpts {
  label: string;
  name: string;
  size: string;
  rows: string;
  license: string;
  category?: string;
  file?: string;
}

export async function registerDataset(ctx: CliContext, opts: RegisterOpts): Promise<string> {
  const id = datasetIdFromLabel(opts.label);
  const content = opts.file ? fs.readFileSync(opts.file) : new Uint8Array();
  ctx.store.set(id, datasetSlicesFromBytes(content));
  const category = opts.category ?? 'General AI';
  console.log(`Registering "${opts.name}" (${category}, id ${bytes32ToHex(id).slice(0, 16)}…)`);
  const txData = await ctx.found.callTx.registerDataset(id, opts.name, category, BigInt(opts.size), opts.rows, opts.license);
  console.log('  ✅ submitted txId', txData.public.txId);
  return txData.public.txId;
}

export async function proveIntegrity(ctx: CliContext, label: string, file?: string): Promise<unknown> {
  const id = datasetIdFromLabel(label);
  let content = ctx.store.get(id);
  if (!content) {
    if (!file) throw new Error('no slices in session; provide file');
    content = datasetSlicesFromBytes(fs.readFileSync(file));
    ctx.store.set(id, content);
  }
  const txData = await ctx.found.callTx.proveIntegrity(id);
  console.log(`  ✅ proof submitted txId ${txData.public.txId}`);
  return txData;
}

export async function setDatasetActive(ctx: CliContext, label: string, active: boolean): Promise<unknown> {
  const id = datasetIdFromLabel(label);
  const txData = await ctx.found.callTx.setActive(id, active);
  console.log(`  ✅ ${label} active=${active} txId ${txData.public.txId}`);
  return txData;
}

export async function readRowCount(ctx: CliContext, label: string): Promise<string> {
  const id = datasetIdFromLabel(label);
  const txData = await ctx.found.callTx.readRowCount(id);
  const result = String((txData as any).public?.result ?? 'unknown');
  console.log(`  ℹ ${label} rows: ${result}`);
  return result;
}

async function main(): Promise<void> {
  ensureContractCompiled();
  const rawArgs = process.argv.slice(2);

  // Separate positional arguments from flags and their values.
  // The previous code stripped all flags before looking for flag values,
  // so --file was silently discarded (M7 fix).
  const positionalArgs: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--file' && i + 1 < rawArgs.length) {
      flags.set('--file', rawArgs[++i]);
    } else if (rawArgs[i].startsWith('-')) {
      continue; // skip unknown flags
    } else {
      positionalArgs.push(rawArgs[i]);
    }
  }

  if (positionalArgs.length === 0) {
    console.log(help());
    return;
  }

  const command = positionalArgs[0];
  const positional = positionalArgs.slice(1);
  const flag = (name: string): string | null => flags.get(name) ?? null;

  const ctx = await connect();

  try {
    switch (command) {
      case 'register': {
        const [label, name, size, rows, lic] = positional;
        if (!label || !name || !size || !rows || !lic) {
          throw new Error('register requires: <label> <name> <sizeBytes> <rows> <license> [--file <path>]');
        }
        // Input validation (M11)
        if (name.length > 200) throw new Error('Dataset name must be under 200 characters');
        if (lic.length > 100) throw new Error('License identifier must be under 100 characters');
        if (!Number.isFinite(Number(size)) || Number(size) < 0) throw new Error('sizeBytes must be a non-negative number');
        await registerDataset(ctx, { label, name, size, rows, license: lic, file: flag('--file') ?? undefined });
        break;
      }
      case 'list':
        await listDatasets(ctx);
        break;
      case 'prove': {
        const label = positional[0];
        if (!label) throw new Error('prove requires: <label>');
        await proveIntegrity(ctx, label, flag('--file') ?? undefined);
        break;
      }
      case 'set-active': {
        const [label, onoff] = positional;
        if (!label || !onoff) throw new Error('set-active requires: <label> <on|off>');
        await setDatasetActive(ctx, label, onoff === 'on');
        break;
      }
      case 'row-count': {
        const label = positional[0];
        if (!label) throw new Error('row-count requires: <label>');
        await readRowCount(ctx, label);
        break;
      }
      default:
        throw new Error(`Unknown command: ${command}\n\n${help()}`);
    }
  } finally {
    await ctx.walletCtx.wallet.stop();
  }
}

const isSelf = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isSelf) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
