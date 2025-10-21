import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import io from 'socket.io-client';

const SOCKET_URL = 'https://socket.pakraillive.com';
const SOCKET_OPTIONS = {
  path: '/socket.io',
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: Infinity,
  timeout: 10000,
  forceNew: true,
  autoConnect: true,
  upgrade: false,
  query: {
    EIO: '3'
  },
  secure: true
};

const EVENTS = ['all-newtrains-delta', 'all-newtrains', 'all-trains-delta'];
const captureMs = Number.isFinite(Number(process.argv[2])) ? Number(process.argv[2]) : 15000;
const startedAt = Date.now();

const socket = io(SOCKET_URL, {
  path: SOCKET_OPTIONS.path,
  transports: [...SOCKET_OPTIONS.transports],
  reconnection: SOCKET_OPTIONS.reconnection,
  reconnectionDelay: SOCKET_OPTIONS.reconnectionDelay,
  reconnectionAttempts: SOCKET_OPTIONS.reconnectionAttempts,
  timeout: SOCKET_OPTIONS.timeout,
  forceNew: SOCKET_OPTIONS.forceNew,
  autoConnect: SOCKET_OPTIONS.autoConnect,
  upgrade: SOCKET_OPTIONS.upgrade,
  query: SOCKET_OPTIONS.query,
  secure: SOCKET_OPTIONS.secure
});

const events = [];
const meta = {
  startedAt: new Date(startedAt).toISOString(),
  captureMs,
  connectedAt: null,
  disconnectReason: null,
  errors: []
};

socket.on('connect', () => {
  meta.connectedAt = new Date().toISOString();
  console.log(`[capture] connected at ${meta.connectedAt}`);
});

socket.on('disconnect', (reason) => {
  meta.disconnectReason = reason;
  console.log(`[capture] disconnected: ${reason}`);
});

socket.on('connect_error', (err) => {
  meta.errors.push({ type: 'connect_error', message: err.message, stack: err.stack });
  console.error('[capture] connect_error', err.message);
});

socket.on('error', (err) => {
  meta.errors.push({ type: 'error', message: err.message, stack: err.stack });
  console.error('[capture] error', err.message);
});

EVENTS.forEach((eventName) => {
  socket.on(eventName, (payload) => {
    events.push({
      event: eventName,
      receivedAt: new Date().toISOString(),
      payload
    });
  });
});

const finalize = () => {
  socket.removeAllListeners();
  socket.disconnect();
  const finishedAt = Date.now();
  meta.finishedAt = new Date(finishedAt).toISOString();
  meta.receivedCount = events.length;

  const outputDir = path.join(process.cwd(), 'datapoints', 'captures');
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `socket-capture-${new Date(startedAt).toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(outputDir, filename);

  const snapshot = {
    meta,
    events
  };

  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  console.log(`[capture] saved ${events.length} events to ${filePath}`);
};

setTimeout(finalize, captureMs);

process.on('SIGINT', () => {
  console.log('[capture] interrupted, flushing data...');
  finalize();
  process.exit(0);
});
