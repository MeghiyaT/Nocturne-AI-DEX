/// <reference types="vite/client" />

declare module '@midnight-ntwrk/midnight-js-contracts' {
  export const findDeployedContract: any;
  const content: any;
  export default content;
}

declare module '@midnight-ntwrk/midnight-js-protocol/compact-js' {
  export const CompiledContract: any;
  const content: any;
  export default content;
}

declare module '@midnight-ntwrk/midnight-js-http-client-proof-provider' {
  export const httpClientProofProvider: any;
  const content: any;
  export default content;
}

declare module '@midnight-ntwrk/midnight-js-indexer-public-data-provider' {
  export const indexerPublicDataProvider: any;
  const content: any;
  export default content;
}

declare module '@midnight-ntwrk/*' {
  const content: any;
  export default content;
}
