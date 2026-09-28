// Shared polyfills for Nocturne AI backend scripts.
//
// Node.js scripts that interact with the Midnight wallet SDK require the
// `ws` package to be assigned to globalThis.WebSocket. Import this module
// once at the entry-point of each script instead of repeating the assignment.

import { WebSocket } from 'ws';

// @ts-expect-error The wallet SDK expects a browser-compatible WebSocket on globalThis.
globalThis.WebSocket = WebSocket;
