// Report wallet balances (tNIGHT + DUST) for the active network.
//
// Non-interactive — used by `npm run check-balance` and by the e2e check.
// Mirrors deploy.ts's wallet bootstrap but performs no on-chain writes.
import './polyfills';
import { pathToFileURL } from 'node:url';
import { resolveNetwork, getOrCreateWallet } from './network';
import { createWallet, unshieldedToken } from './wallet';

import * as Rx from 'rxjs';



export interface BalanceReport {
  network: string;
  address: string;
  tNight: bigint;
  dust: bigint;
}

export async function checkBalance(): Promise<BalanceReport> {
  const { network, config: networkConfig } = resolveNetwork();
  const { seed } = getOrCreateWallet(network);
  const walletCtx = await createWallet({ network, networkConfig, seed });
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.filter((s: any) => {
        const tn = s?.unshielded?.balances?.[unshieldedToken().raw] ?? 0n;
        return s.isSynced || tn > 0n;
      }),
      Rx.timeout({ first: 120_000 }),
    ),
  ).catch((err) => {
    if (err?.name === 'TimeoutError') {
      throw new Error('Wallet sync timed out after 120 seconds. Check network connectivity and try again.');
    }
    throw err;
  });
  const address = walletCtx.unshieldedKeystore.getBech32Address();
  const tNight = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  const dust = state.dust.balance(new Date());

  console.log('');
  console.log(`Active network:  ${network}`);
  console.log(`Address:         ${address}`);
  console.log(`tNIGHT:          ${tNight.toLocaleString()}`);
  console.log(`DUST:            ${dust.toLocaleString()}`);
  console.log('');

  const report: BalanceReport = { network, address: address.toString(), tNight, dust };
  await walletCtx.wallet.stop();
  return report;
}

async function main() {
  await checkBalance();
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
