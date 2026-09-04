// ============================================================================
// offlineSync.js — Offline-to-Online sync strategy.
//
// This runs in the user's actual browser (a deployed Vite/React app, not a
// sandboxed preview), so localStorage is a safe, standard choice here — it
// persists a queue of actions taken while the connection was down, and
// replays them in order once connectivity returns. Combined with the
// optimistic UI update in POSTab (stock is decremented on-screen immediately,
// before the server confirms), a cashier can keep selling through a network
// outage without the till ever appearing to "freeze".
// ============================================================================
import * as pos from './posService';

const QUEUE_KEY = 'lsic_offline_outbox';
const listeners = new Set();

const readQueue = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
};
const writeQueue = (q) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  listeners.forEach(fn => fn(q));
};

// Handlers: how to actually replay each queued action type against Supabase.
const HANDLERS = {
  pos_sale: (payload) => pos.processSale(payload),
  stock_adjust: (payload) => pos.adjustStock(payload.productId, payload.delta, payload.reason),
};

export function getQueue() { return readQueue(); }

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function enqueue(type, payload) {
  const q = readQueue();
  const item = { id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type, payload, createdAt: new Date().toISOString(), attempts: 0, lastError: null };
  q.push(item);
  writeQueue(q);
  return item.id;
}

let syncing = false;

/** Replay the queue in order. Stops advancing past an item that still fails
 * (keeps ordering correct for sales against the same stock) but reports how
 * many succeeded so the UI can show progress. */
export async function processQueue() {
  if (syncing) return { synced: 0, remaining: readQueue().length };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { synced: 0, remaining: readQueue().length };
  syncing = true;
  let synced = 0;
  try {
    let q = readQueue();
    const remaining = [];
    for (const item of q) {
      const handler = HANDLERS[item.type];
      if (!handler) { remaining.push(item); continue; }
      const { error } = await handler(item.payload);
      if (error) {
        remaining.push({ ...item, attempts: item.attempts + 1, lastError: error });
      } else {
        synced += 1;
      }
    }
    writeQueue(remaining);
    return { synced, remaining: remaining.length };
  } finally {
    syncing = false;
  }
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
