// useContractBridge.ts
// React hook that manages the ContractBridge lifecycle and exposes
// circuit call functions with loading/error state.

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getContractBridge,
  resetContractBridge,
  type ContractBridgeState,
  type RegisterParams,
  type RegisterResult,
  type ProveResult,
  type SetActiveResult,
} from '../services/contractBridge';
import type { BrowserDatasetStore } from '../utils/datasetUtils';

export interface ContractBridgeHook {
  /** Whether the bridge has been initialized with the wallet. */
  bridgeReady: boolean;
  /** Whether the Midnight SDK providers are fully wired (contract found on-chain). */
  sdkInitialized: boolean;
  /** Whether the proof server is online and accepting requests. */
  proofServerOnline: boolean;
  /** Error message from the proof server, if offline. */
  proofServerError: string | null;
  /** Whether any circuit call is currently in progress. */
  loading: boolean;
  /** Descriptive status message for the current operation. */
  statusMessage: string | null;
  /** Last error from a circuit call. */
  error: string | null;
  /** Access to the in-memory slice store for cross-component sharing. */
  sliceStore: BrowserDatasetStore | null;
  /** Register a dataset on-chain. */
  registerDataset: (params: RegisterParams) => Promise<RegisterResult>;
  /** Prove dataset integrity on-chain. */
  proveIntegrity: (datasetId: string, fileContent?: Uint8Array) => Promise<ProveResult>;
  /** Toggle dataset active status on-chain. */
  setActive: (datasetId: string, active: boolean) => Promise<SetActiveResult>;
  /** Re-check proof server connectivity. */
  refreshProofServer: () => Promise<boolean>;
}

export function useContractBridge(
  walletApi: any | null,
  walletAddress: string | null,
): ContractBridgeHook {
  const [bridgeState, setBridgeState] = useState<ContractBridgeState>({
    isInitialized: false,
    isProofServerOnline: false,
    proofServerError: null,
    contractAddress: '',
  });
  const [bridgeReady, setBridgeReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initAttemptedRef = useRef(false);
  const prevAddressRef = useRef<string | null>(null);
  const bridgeReadyRef = useRef(false);
  bridgeReadyRef.current = bridgeReady;

  // Initialize bridge when wallet connects
  useEffect(() => {
    if (!walletApi || !walletAddress) {
      // Wallet disconnected — tear down
      if (bridgeReadyRef.current) {
        resetContractBridge();
        setBridgeReady(false);
        setBridgeState({
          isInitialized: false,
          isProofServerOnline: false,
          proofServerError: null,
          contractAddress: '',
        });
        initAttemptedRef.current = false;
        prevAddressRef.current = null;
      }
      return;
    }

    // Don't re-init for the same address
    if (prevAddressRef.current === walletAddress && initAttemptedRef.current) {
      return;
    }

    prevAddressRef.current = walletAddress;
    initAttemptedRef.current = true;

    const bridge = getContractBridge();
    bridge.init(walletApi, walletAddress).then((state) => {
      setBridgeState(state);
      setBridgeReady(true);
    }).catch((err) => {
      console.error('[useContractBridge] Init failed:', err);
      setBridgeReady(true); // Still "ready" in that we can do local-only operations
      setBridgeState({
        isInitialized: false,
        isProofServerOnline: false,
        proofServerError: err?.message || 'Bridge initialization failed',
        contractAddress: '',
      });
    });
  }, [walletApi, walletAddress]);

  // Also initialize without wallet (for proof server status check)
  useEffect(() => {
    if (walletApi || bridgeReady) return;

    // Check proof server even without wallet
    const bridge = getContractBridge();
    bridge.refreshProofServerStatus().then((online) => {
      setBridgeState((prev) => ({
        ...prev,
        isProofServerOnline: online,
        proofServerError: online ? null : 'Proof server is currently offline. On-chain operations are unavailable.',
      }));
    });
  }, [walletApi, bridgeReady]);

  const registerDataset = useCallback(async (params: RegisterParams): Promise<RegisterResult> => {
    const bridge = getContractBridge();
    setLoading(true);
    setError(null);
    setStatusMessage('Computing dataset slices...');

    try {
      setStatusMessage(
        bridgeState.isProofServerOnline
          ? 'Generating ZK proof & submitting to Midnight...'
          : 'Computing local integrity anchors...',
      );

      const result = await bridge.registerDataset(params);

      if (result.error && !result.success) {
        setError(result.error);
      } else if (result.error) {
        // Partial success (local ok, on-chain pending)
        setStatusMessage(result.error);
      } else {
        setStatusMessage(null);
      }

      return result;
    } catch (err: any) {
      const msg = err?.message || 'Registration failed';
      setError(msg);
      return {
        success: false,
        datasetId: '',
        dataCommitment: '',
        providerCommit: '',
        error: msg,
      };
    } finally {
      setLoading(false);
    }
  }, [bridgeState.isProofServerOnline]);

  const proveIntegrity = useCallback(async (
    datasetId: string,
    fileContent?: Uint8Array,
  ): Promise<ProveResult> => {
    const bridge = getContractBridge();
    setLoading(true);
    setError(null);
    setStatusMessage(
      bridgeState.isProofServerOnline
        ? 'Generating zero-knowledge integrity proof...'
        : 'Performing local hash verification...',
    );

    try {
      const result = await bridge.proveIntegrity(datasetId, fileContent);

      if (result.error && !result.success) {
        setError(result.error);
      }

      setStatusMessage(null);
      return result;
    } catch (err: any) {
      const msg = err?.message || 'Integrity proof failed';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [bridgeState.isProofServerOnline]);

  const setActive = useCallback(async (
    datasetId: string,
    active: boolean,
  ): Promise<SetActiveResult> => {
    const bridge = getContractBridge();
    setLoading(true);
    setError(null);
    setStatusMessage('Updating listing visibility on-chain...');

    try {
      const result = await bridge.setActive(datasetId, active);
      if (!result.success && result.error) {
        setError(result.error);
      }
      setStatusMessage(null);
      return result;
    } catch (err: any) {
      const msg = err?.message || 'setActive failed';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProofServer = useCallback(async (): Promise<boolean> => {
    const bridge = getContractBridge();
    const online = await bridge.refreshProofServerStatus();
    setBridgeState((prev) => ({
      ...prev,
      isProofServerOnline: online,
      proofServerError: online ? null : 'Proof server is currently offline.',
    }));
    return online;
  }, []);

  const sliceStore = bridgeReady ? getContractBridge().getSliceStore() : null;

  return {
    bridgeReady,
    sdkInitialized: bridgeState.isInitialized,
    proofServerOnline: bridgeState.isProofServerOnline,
    proofServerError: bridgeState.proofServerError,
    loading,
    statusMessage,
    error,
    sliceStore,
    registerDataset,
    proveIntegrity,
    setActive,
    refreshProofServer,
  };
}
