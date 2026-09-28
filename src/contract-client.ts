// Shared contract wiring for Nocturne AI:
//  - locates the compiled datasetRegistry contract artifacts
//  - wires the real witnesses the contract requires (providerSecret +
//    datasetSlices) as in-memory, call-scope values
//  - assembles the providers bundle used by deploy and CLI flows.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { NetworkConfig } from './network';
import type { WalletContext } from './wallet';
import type { SliceProvider } from './dataset';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ZK_CONFIG_PATH = path.resolve(here, '..', 'contracts', 'managed', 'datasetRegistry');
export const CONTRACT_PATH = path.join(ZK_CONFIG_PATH, 'contract', 'index.js');

export function ensureContractCompiled(): void {
  if (!fs.existsSync(CONTRACT_PATH)) {
    throw new Error('Contract not compiled. Run: npm run compile');
  }
}

export interface LoadedContract {
  compiledContract: ReturnType<typeof buildCompiledContract>;
  ledger: (state: unknown) => unknown;
}

export function buildCompiledContract(
  ContractCtor: any,
  providerSecret: Uint8Array,
  sliceProvider: SliceProvider,
) {
  ensureContractCompiled();
  const base = (CompiledContract as any).make('datasetRegistry', ContractCtor);
  return base
    .pipe(
      (CompiledContract as any).withWitnesses({
        providerSecret(context: any): [unknown, Uint8Array] {
          return [context.privateState, providerSecret];
        },
        async datasetSlices(context: any, datasetId: Uint8Array): Promise<[unknown, Uint8Array[]]> {
          void context;
          const slices = await sliceProvider(datasetId);
          return [context.privateState, slices];
        },
      }),
      (CompiledContract as any).withCompiledFileAssets(ZK_CONFIG_PATH),
    );
}

export async function loadCompiledContract(
  sliceProvider: SliceProvider,
  providerSecret: Uint8Array,
): Promise<LoadedContract> {
  const source = (await import(pathToFileURL(CONTRACT_PATH).href)) as any;
  return {
    compiledContract: buildCompiledContract(source.Contract, providerSecret, sliceProvider),
    ledger: source.ledger,
  };
}

export function createProviders(
  walletCtx: WalletContext,
  networkConfig: NetworkConfig,
  opts: { privateStateId?: string } = {},
): any {
  const envPassword = process.env.PRIVATE_STATE_PASSWORD?.trim();
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();
  // NOTE: dustSecretKey is included to make the derived password unique per
  // wallet identity. This value never leaves the local machine — it's used
  // solely as a LevelDB encryption key for private state storage.
  const derivedHex = crypto
    .createHash('sha256')
    .update(`nocturne:privatestate:${networkConfig.networkId}:${accountId}:${walletCtx.dustSecretKey}`)
    .digest('hex');
  const derivedFallbackPassword = `NOC_Zk!${derivedHex.slice(0, 32)}$A1`;
  const privateStatePassword = envPassword || derivedFallbackPassword;

  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    balanceTx: (tx: any, ttl?: Date) =>
      walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      ),
    submitTx: async (recipe: any) => {
      // balanceTx returns a BalancingRecipe. The wallet requires it to be
      // finalised (ledger signature applied) before submitTransaction can call
      // tx.identifiers(). wallet.finalizeRecipe converts the recipe to a
      // ledger-signed Transaction, which submitTransaction then accepts.
      const finalizedTx = await walletCtx.wallet.finalizeRecipe(recipe);
      return walletCtx.wallet.submitTransaction(finalizedTx) as any;
    },

  };

  const zkConfigProvider = new NodeZkConfigProvider(ZK_CONFIG_PATH);
  const privateStateProvider = levelPrivateStateProvider({
    privateStateStoreName: opts.privateStateId ?? 'nocturne-state',
    accountId,
    privateStoragePasswordProvider: () => privateStatePassword,
  });

  return {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}
