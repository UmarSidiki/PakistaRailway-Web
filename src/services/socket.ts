// socket.ts
import io from 'socket.io-client';
import type { Socket as IOSocket } from 'socket.io-client';
import type { SocketMessageEnvelope } from '@/types';
import { SOCKET_OPTIONS, SOCKET_URL, flattenSocketEnvelope } from './liveData';

type DeltaHandler = (deltas: ReturnType<typeof flattenSocketEnvelope>) => void;

export type SocketEvents = {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onReconnectAttempt?: (attempt: number) => void;
  onReconnect?: (attempt: number) => void;
  onError?: (error: Error) => void;
};

let singletonSocket: typeof import("socket.io-client").Socket | null = null;
let handlerRefs: Set<DeltaHandler> = new Set();

export const connectLiveSocket = (handler: DeltaHandler, events?: SocketEvents): (() => void) => {
  if (!singletonSocket) {
    singletonSocket = io(SOCKET_URL, {
      ...SOCKET_OPTIONS,
      transports: [...SOCKET_OPTIONS.transports]
    });

    // Register event listeners once
    singletonSocket.on('connect', events?.onConnect ?? (() => {}));
    singletonSocket.on('disconnect', events?.onDisconnect ?? (() => {}));
    singletonSocket.on('connect_error', events?.onError ?? (() => {}));
    singletonSocket.on('error', events?.onError ?? (() => {}));
    singletonSocket.io.on('reconnect_attempt', events?.onReconnectAttempt ?? (() => {}));
    singletonSocket.io.on('reconnect', events?.onReconnect ?? (() => {}));

    // Data listeners call all registered handlers
    const handleEnvelope = (payload: SocketMessageEnvelope) => {
      const deltas = flattenSocketEnvelope(payload);
      if (deltas.length > 0) {
        handlerRefs.forEach(fn => fn(deltas));
      }
    };
    singletonSocket.on('all-newtrains-delta', handleEnvelope);
    singletonSocket.on('all-newtrains', handleEnvelope);
    singletonSocket.on('all-trains-delta', handleEnvelope);
  }

  handlerRefs.add(handler);

  // Return a cleanup function
  return () => {
    handlerRefs.delete(handler);
    // Optionally disconnect if no handlers remain
    if (handlerRefs.size === 0 && singletonSocket) {
      singletonSocket.disconnect();
      singletonSocket = null;
    }
  };
};