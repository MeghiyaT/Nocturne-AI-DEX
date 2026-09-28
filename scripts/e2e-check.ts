// End-to-end smoke test against the deployed Nocturne AI contract.
//
// Assumes `npm run setup` already ran (deployment recorded in .midnight-state.json).
// Run: npm run check:e2e
import '../src/polyfills';
import { resolveNetwork, getDeployment } from '../src/network';
import { checkBalance } from '../src/check-balance';
import { ensureContractCompiled } from '../src/contract-client';
import {
  connect,
  registerDataset,
  listDatasets,
  proveIntegrity,
  setDatasetActive,
  readRowCount,
  type CliContext,
} from '../src/cli';



function ok(label: string): void {
  console.log(`  ✔ ${label}`);
}

async function main(): Promise<void> {
  const { network } = resolveNetwork();
  console.log(`\n── Nocturne AI e2e: network=${network} ──────────────────────────────\n`);

  const deployment = getDeployment(network);
  if (!deployment) {
    console.log('❌ No deployment found. Run `npm run setup` first.');
    process.exit(1);
  }
  ok(`deployment recorded: ${deployment.address}`);

  ensureContractCompiled();
  ok('contract compiled artifacts present');

  const { address, tNight, dust } = await checkBalance();
  ok(`wallet address ${address}; balance tNight=${tNight} dust=${dust}`);
  if (deployment.deployer && deployment.deployer !== address) {
    console.log('  ⚠ deployer differs from current wallet — owner ops may fail.');
  }

  const ctx: CliContext = await connect();
  ok('connected to deployed contract');

  const label = `e2e-${Date.now().toString(36)}`;
  console.log(`\n-- test dataset: ${label}\n`);
  await registerDataset(ctx, {
    label,
    name: `e2e dataset ${Date.now()}`,
    category: 'General AI',
    size: '1024',
    rows: '42',
    license: 'CC-BY-4.0',
    file: undefined,
  });
  ok('register tx submitted');

  const rowsBefore = await listDatasets(ctx);
  ok(`registry lists ${rowsBefore.length} dataset(s)`);

  await proveIntegrity(ctx, label);
  ok('prove tx submitted');

  await setDatasetActive(ctx, label, true);
  ok('set-active(on) tx submitted');

  const count = await readRowCount(ctx, label);
  ok(`readRowCount → ${count}`);

  await ctx.walletCtx.wallet.stop();
  console.log('\n── e2e checks complete ─────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
