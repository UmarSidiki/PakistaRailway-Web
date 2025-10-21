// socket.ts
import io, { Socket } from 'socket.io-client';
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

export const connectLiveSocket = (handler: DeltaHandler, events?: SocketEvents): (() => void) => {
  // FIX 1: Let TypeScript infer the socket's type. This is safer and avoids naming conflicts.
  // FIX 2: Create a new options object and spread the readonly 'transports' array
  // to create a mutable copy that socket.io can accept.
  const socket = io(SOCKET_URL, {
    ...SOCKET_OPTIONS,
    transports: [...SOCKET_OPTIONS.transports]
  });

  const handleEnvelope = (payload: SocketMessageEnvelope) => {
    const deltas = flattenSocketEnvelope(payload);
    if (deltas.length > 0) {
      handler(deltas);
    }
  };

  // Register event listeners, providing a no-op function as a fallback
  socket.on('connect', events?.onConnect ?? (() => {}));
  socket.on('disconnect', events?.onDisconnect ?? (() => {}));
  socket.on('connect_error', events?.onError ?? (() => {}));
  socket.on('error', events?.onError ?? (() => {}));
  socket.io.on('reconnect_attempt', events?.onReconnectAttempt ?? (() => {}));
  socket.io.on('reconnect', events?.onReconnect ?? (() => {}));

  // Register data listeners
  socket.on('all-newtrains-delta', handleEnvelope);
  socket.on('all-newtrains', handleEnvelope);
  socket.on('all-trains-delta', handleEnvelope);

  // Return a cleanup function
  return () => {
    // Also use the fallback when removing listeners
    socket.off('connect', events?.onConnect ?? (() => {}));
    socket.off('disconnect', events?.onDisconnect ?? (() => {}));
    socket.off('connect_error', events?.onError ?? (() => {}));
    socket.off('error', events?.onError ?? (() => {}));
    socket.io.off('reconnect_attempt', events?.onReconnectAttempt ?? (() => {}));
    socket.io.off('reconnect', events?.onReconnect ?? (() => {}));

    socket.off('all-newtrains-delta', handleEnvelope);
    socket.off('all-newtrains', handleEnvelope);
    socket.off('all-trains-delta', handleEnvelope);
    socket.disconnect();
  };
};