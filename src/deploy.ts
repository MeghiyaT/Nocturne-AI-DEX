// Deploy the Nocturne AI datasetRegistry contract to a Midnight network.
//
// Non-interactive: scaffold → npm run setup runs straight through.
import './polyfills';
import { pathToFileURL } from 'node:url';
import * as Rx from 'rxjs';

// Midnight SDK imports
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, recordDeployment, type NetworkConfig } from './network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet';
import { loadCompiledContract, createProviders } from './contract-client';
import { DatasetStore, sha256, datasetStoreToSliceProvider } from './dataset';



const PRIVATE_STATE_ID = 'nocturneState';

// ─── Timing constants ────────────────────────────────────────────────────────
/** How often (ms) the faucet-funding loop polls the wallet for a new balance. */
const FAUCET_POLL_MS = 10_000;
/**
 * How long (ms) to wait after the proof server confirms DUST is active before
 * attempting contract deployment. The SDK needs time to settle the generated
 * DUST on-chain before it can be spent in the deployment transaction.
 */
const DUST_SETTLE_WAIT_MS = 15_000;
// ─────────────────────────────────────────────────────────────────────────────



async function waitForProofServer(proofServerUrl: string, maxAttempts = 60, delayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fetch(proofServerUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return true;
    } catch (err: any) {
      const code = err?.cause?.code || err?.code || '';
      if (code !== 'ECONNREFUSED' && code !== 'UND_ERR_CONNECT_TIMEOUT' && code !== 'UND_ERR_SOCKET') {
        return true;
      }
    }
    if (attempt < maxAttempts) {
      process.stdout.write(`\r  Waiting for proof server... (${attempt}/${maxAttempts})   `);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

// The compiled datasetRegistry contract *requires* its two witnesses to be
// installed even for the constructor call. We wire them from the shared
// contract-client: providerSecret is a stable 32-byte value derived from the
// wallet seed, and datasetSlices is backed by an in-memory store (unused
// during deploy, needed later by the CLI).

function deriveProviderSecret(seed: string): Uint8Array {
  // Stable 32-byte identity secret derived from the wallet seed. Never logged.
  const raw = Buffer.from(seed, 'hex');
  const secret =
    raw.length >= 32
      ? raw.subarray(0, 32)
      : Buffer.concat([raw, Buffer.alloc(32 - raw.length)]);
  // Hash it so the on-chain ownerCommit never reveals seed material directly.
  return sha256(new Uint8Array(secret));
}

async function initContract(ctx: WalletContext, networkConfig: NetworkConfig, seed: string) {
  const store = new DatasetStore();
  const provider = datasetStoreToSliceProvider(store);
  const compiled = await loadCompiledContract(provider, deriveProviderSecret(seed));
  return {
    compiledContract: compiled.compiledContract,
    providers: createProviders(ctx, networkConfig),
  };
}

export async function deploy() {
  const { network, config: networkConfig } = resolveNetwork();
  const wallet = getOrCreateWallet(network);
  const seed = wallet.seed;
  {
    const notice = formatWalletBackupNotice(wallet, network);
    if (notice) console.log(notice);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  Deploy Nocturne AI to ${network}`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('─── Wallet setup ───────────────────────────────────────────────\n');
  console.log('  Creating wallet...');
  const walletCtx = await createWallet({ network, networkConfig, seed });
  const restoredCount = Object.values(walletCtx.restored).filter(Boolean).length;
  if (restoredCount > 0) {
    console.log(`  Restored ${restoredCount}/3 child wallets from .midnight-wallet-state — sync will resume from saved point.`);
  }

  console.log('  Syncing with network...');
  console.log('  ℹ  This may take several minutes depending on network size.');

  const syncSub = walletCtx.wallet.state().pipe(Rx.throttleTime(5000)).subscribe((s: any) => {
    const tn = s?.unshielded?.balances?.[unshieldedToken().raw] ?? 0n;
    const dustBal = s?.dust ? s.dust.balance(new Date()) : 0n;
    if (tn > 0n || s.isSynced) {
      console.log(`  ✓ Unshielded balance synced (tNIGHT: ${tn.toLocaleString()}, DUST: ${dustBal.toLocaleString()})`);
    } else {
      console.log(`  ...syncing in progress (isSynced: ${s.isSynced})`);
    }
  });

  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.filter((s: any) => {
        const tn = s?.unshielded?.balances?.[unshieldedToken().raw] ?? 0n;
        return s.isSynced || tn > 0n;
      }),
    ),
  );
  syncSub.unsubscribe();
  process.stdout.write('\r  ✓ Ready to deploy on network.                                      \n');

  await persistWalletState(network, walletCtx);

  const address = walletCtx.unshieldedKeystore.getBech32Address();
  let balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`\n  Wallet Address: ${address}`);
  console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

  if (network !== 'undeployed' && networkConfig.faucet) {
    if (balance === 0n) {
      console.log('─── Fund Wallet ────────────────────────────────────────────────\n');
      console.log(`  Wallet address: ${address}`);
      console.log(`  Faucet:         ${networkConfig.faucet}`);
      console.log('');
      console.log('  Waiting for tNIGHT to arrive (poll every 10s)...');
      const rawTimeout = Number(process.env.MIDNIGHT_FAUCET_TIMEOUT_MS);
      const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 300_000;
      const start = Date.now();
      while (true) {
        await new Promise((r) => setTimeout(r, FAUCET_POLL_MS));
        const s = await Rx.firstValueFrom(
          walletCtx.wallet.state().pipe(
            Rx.filter((x: any) => {
              const tn = x?.unshielded?.balances?.[unshieldedToken().raw] ?? 0n;
              return x.isSynced || tn > 0n;
            }),
          ),
        );
        const tn = s.unshielded.balances[unshieldedToken().raw] ?? 0n;
        if (tn > 0n) {
          console.log(`\n  Funded! tNIGHT balance: ${tn.toLocaleString()}\n`);
          break;
        }
        if (Date.now() - start > timeoutMs) {
          console.log(`\n  ❌ Funding not received within ${Math.round(timeoutMs / 60_000)} min.`);
          console.log(`  Address: ${address}`);
          console.log(`  Faucet:  ${networkConfig.faucet}`);
          console.log('  Re-run setup after funding — your seed is preserved.\n');
          await walletCtx.wallet.stop();
          process.exit(1);
        }
        process.stdout.write(`\r  ...still waiting (${Math.round((Date.now() - start) / 1000)}s elapsed)`);
      }
    }
  }

  console.log('─── DUST Token Setup ───────────────────────────────────────────\n');
  const freshState = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.filter((s: any) => (s?.unshielded?.availableCoins?.length ?? 0) > 0 || (s?.unshielded?.balances?.[unshieldedToken().raw] ?? 0n) > 0n),
    ),
  );
  const unregisteredUtxos = (freshState.unshielded.availableCoins || []).filter(
    (c: any) => !c.meta?.registeredForDustGeneration,
  );
  if (unregisteredUtxos.length > 0) {
    console.log(`  Registering ${unregisteredUtxos.length} NIGHT UTXOs for DUST generation...`);
    try {
      const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
        unregisteredUtxos,
        walletCtx.unshieldedKeystore.getPublicKey(),
        (payload) => walletCtx.unshieldedKeystore.signData(payload),
      );
      const finalized = await walletCtx.wallet.finalizeRecipe(recipe);
      await walletCtx.wallet.submitTransaction(finalized);
      console.log('  ✓ Registered NIGHT UTXOs for DUST generation.');
    } catch (e: any) {
      console.log(`  ℹ DUST registration status: ${e?.message || e}`);
    }
  }

  console.log('  Waiting for active DUST tokens...');
  await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.throttleTime(2000),
      Rx.filter((s: any) => s.dust.balance(new Date()) > 0n),
    ),
  );
  console.log('  ✓ DUST tokens active and ready!\n');

  console.log('─── Deploy Contract ────────────────────────────────────────────\n');
  console.log('  Checking proof server...');
  const proofServerReady = await waitForProofServer(networkConfig.proofServer);
  if (!proofServerReady) {
    console.log('\n  ❌ Proof server not responding. Run: docker compose up -d\n');
    await walletCtx.wallet.stop();
    process.exit(1);
  }
  process.stdout.write('\r  Proof server ready!                                 \n');

  const { compiledContract, providers } = await initContract(walletCtx, networkConfig, seed);
  process.stdout.write('  Generating & settling on-chain DUST...');
  await new Promise((r) => setTimeout(r, DUST_SETTLE_WAIT_MS));
  process.stdout.write(' done.\n');
  console.log('  Deploying contract...\n');

  const MAX_RETRIES = 20;
  const RETRY_DELAY_MS = 5000;
  let deployed: Awaited<ReturnType<typeof deployContract>> | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      deployed = await deployContract(providers, {
        compiledContract: compiledContract as any,
        args: [],
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
      });
      break;
    } catch (err: any) {
      let currentErr: any = err;
      const allErrStrings: string[] = [];
      while (currentErr) {
        if (currentErr.message) allErrStrings.push(String(currentErr.message));
        if (currentErr.name) allErrStrings.push(String(currentErr.name));
        if (typeof currentErr === 'string') allErrStrings.push(currentErr);
        currentErr = currentErr.cause;
      }
      const fullError = allErrStrings.join(' ') + ' ' + String(err);
      const errMsg = err?.message || err?.toString() || '';

      const isRetryable =
        fullError.includes('Not enough Dust') ||
        fullError.includes('Insufficient Funds') ||
        fullError.includes('could not balance dust') ||
        fullError.includes('SubmissionError') ||
        fullError.includes('1010') ||
        fullError.includes('170') ||
        fullError.includes('Invalid Transaction');

      console.error(`\n  Attempt ${attempt} error: ${errMsg}`);
      if (err?.cause) console.error(`  Cause: ${err.cause?.message || String(err.cause)}`);

      if (isRetryable) {
        const currentState = await Rx.firstValueFrom(walletCtx.wallet.state());
        const dustBalance = currentState.dust.balance(new Date());
        if (attempt < MAX_RETRIES) {
          console.log(`  ⏳ Retrying deployment in ${RETRY_DELAY_MS / 1000}s (attempt ${attempt}/${MAX_RETRIES}, DUST: ${dustBalance.toLocaleString()})...`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        } else {
          console.log(`  ❌ Deployment unconfirmed after ${MAX_RETRIES} retries`);
          await walletCtx.wallet.stop();
          process.exit(1);
        }
      } else {
        throw err;
      }
    }
  }

  if (!deployed) throw new Error('Deployment failed after all retries');

  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log('  ✅ Contract deployed successfully!\n');
  console.log(`  Contract Address: ${contractAddress}\n`);

  recordDeployment(network, contractAddress, address.toString());
  console.log('  Saved to .midnight-state.json\n');

  await persistWalletState(network, walletCtx);
  await walletCtx.wallet.stop();
  console.log('─── Deployment complete ────────────────────────────────────────\n');
  console.log('  Next: npm run cli\n');
}

function isSelf(): boolean {
  try {
    return !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

// direct invocation
if (isSelf()) {
  deploy().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}