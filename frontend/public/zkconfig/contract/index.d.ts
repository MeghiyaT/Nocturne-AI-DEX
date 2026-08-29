import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  providerSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  datasetSlices(context: __compactRuntime.WitnessContext<Ledger, PS>,
                datasetId_0: Uint8Array): [PS, Uint8Array[]];
}

export type ImpureCircuits<PS> = {
  registerDataset(context: __compactRuntime.CircuitContext<PS>,
                  datasetId_0: Uint8Array,
                  datasetName_0: string,
                  category_0: string,
                  datasetSize_0: bigint,
                  rowCount_0: string,
                  license_0: string): __compactRuntime.CircuitResults<PS, []>;
  proveIntegrity(context: __compactRuntime.CircuitContext<PS>,
                 datasetId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  setActive(context: __compactRuntime.CircuitContext<PS>,
            datasetId_0: Uint8Array,
            active_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  readRowCount(context: __compactRuntime.CircuitContext<PS>,
               datasetId_0: Uint8Array): __compactRuntime.CircuitResults<PS, string>;
}

export type ProvableCircuits<PS> = {
  registerDataset(context: __compactRuntime.CircuitContext<PS>,
                  datasetId_0: Uint8Array,
                  datasetName_0: string,
                  category_0: string,
                  datasetSize_0: bigint,
                  rowCount_0: string,
                  license_0: string): __compactRuntime.CircuitResults<PS, []>;
  proveIntegrity(context: __compactRuntime.CircuitContext<PS>,
                 datasetId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  setActive(context: __compactRuntime.CircuitContext<PS>,
            datasetId_0: Uint8Array,
            active_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  readRowCount(context: __compactRuntime.CircuitContext<PS>,
               datasetId_0: Uint8Array): __compactRuntime.CircuitResults<PS, string>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  registerDataset(context: __compactRuntime.CircuitContext<PS>,
                  datasetId_0: Uint8Array,
                  datasetName_0: string,
                  category_0: string,
                  datasetSize_0: bigint,
                  rowCount_0: string,
                  license_0: string): __compactRuntime.CircuitResults<PS, []>;
  proveIntegrity(context: __compactRuntime.CircuitContext<PS>,
                 datasetId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  setActive(context: __compactRuntime.CircuitContext<PS>,
            datasetId_0: Uint8Array,
            active_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  readRowCount(context: __compactRuntime.CircuitContext<PS>,
               datasetId_0: Uint8Array): __compactRuntime.CircuitResults<PS, string>;
}

export type Ledger = {
  registry: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { providerCommit: Uint8Array,
                                 dataCommitment: Uint8Array,
                                 datasetName: string,
                                 category: string,
                                 datasetSize: bigint,
                                 rowCount: string,
                                 license: string,
                                 isActive: boolean
                               };
    [Symbol.iterator](): Iterator<[Uint8Array, { providerCommit: Uint8Array,
  dataCommitment: Uint8Array,
  datasetName: string,
  category: string,
  datasetSize: bigint,
  rowCount: string,
  license: string,
  isActive: boolean
}]>
  };
  readonly ownerCommit: Uint8Array;
  readonly verifiedCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
