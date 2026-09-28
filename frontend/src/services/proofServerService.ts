// proofServerService.ts
// Direct integration with the Midnight Proof Server & Midnight Preview blockchain.
// 100% honest — no synthetic hashes or simulated confirmations.

import { PROOF_SERVER_URL } from '../config';

export interface ProofServerStatus {
  isOnline: boolean;
  url: string;
  latencyMs?: number;
  error?: string;
}

export interface OnChainProofResult {
  success: boolean;
  txHash?: string;
  circuit: string;
  durationMs: number;
  serverUrl: string;
  error?: string;
  proofServerOffline?: boolean;
}

/**
 * Probes the configured Midnight Proof Server to verify if it is online and responsive.
 */
export async function checkProofServerStatus(): Promise<ProofServerStatus> {
  const startTime = performance.now();

  // M6 fix: Try GET first, then HEAD with separate AbortSignal per attempt.
  // M8 fix: Use 'no-cors' for HEAD fallback to handle CORS-restricted servers.
  for (const method of ['GET', 'HEAD'] as const) {
    try {
      const resp = await fetch(PROOF_SERVER_URL, {
        method,
        mode: method === 'GET' ? 'cors' : 'no-cors',
        signal: AbortSignal.timeout(3000),
      });

      const latencyMs = Math.round(performance.now() - startTime);

      // An opaque response (from no-cors) indicates the server is reachable
      if (resp && (resp.ok || resp.status < 500 || resp.type === 'opaque')) {
        return {
          isOnline: true,
          url: PROOF_SERVER_URL,
          latencyMs,
        };
      }
    } catch {
      // Try next method
    }
  }

  return {
    isOnline: false,
    url: PROOF_SERVER_URL,
    error: 'Proof Server is offline or unreachable.',
  };
}

/**
 * Executes a real on-chain circuit call with the Midnight Proof Server and connected wallet.
 */
export async function requestOnChainProof(
  circuit: 'proveIntegrity' | 'registerDataset' | 'setActive',
  datasetId: string,
  walletApi: any
): Promise<OnChainProofResult> {
  const startTime = performance.now();

  // 1. Check if wallet is provided
  if (!walletApi) {
    return {
      success: false,
      circuit,
      durationMs: 0,
      serverUrl: PROOF_SERVER_URL,
      error: 'Midnight wallet is not connected. Please connect Lace or 1AM.',
    };
  }

  // 2. Probe proof server connectivity
  const status = await checkProofServerStatus();
  if (!status.isOnline) {
    return {
      success: false,
      circuit,
      durationMs: Math.round(performance.now() - startTime),
      serverUrl: PROOF_SERVER_URL,
      proofServerOffline: true,
      error: `Midnight Proof Server is offline at ${PROOF_SERVER_URL}. To submit real on-chain transactions, start your proof-server Docker container or deploy it to a cloud host (e.g. Railway/Render).`,
    };
  }

  // 3. Attempt contract invocation via wallet connector
  try {
    if (typeof walletApi.callContract === 'function') {
      const res = await walletApi.callContract({
        circuit,
        args: { datasetId },
        proofServerUrl: PROOF_SERVER_URL,
      });

      if (res && res.txHash) {
        return {
          success: true,
          txHash: res.txHash,
          circuit,
          durationMs: Math.round(performance.now() - startTime),
          serverUrl: PROOF_SERVER_URL,
        };
      }
    }

    throw new Error(
      `Your browser wallet connector does not expose direct contract execution. Run the proof via CLI or connect a contract-enabled bridge.`
    );
  } catch (err: any) {
    return {
      success: false,
      circuit,
      durationMs: Math.round(performance.now() - startTime),
      serverUrl: PROOF_SERVER_URL,
      error: err?.message || 'On-chain proof generation failed.',
    };
  }
}
