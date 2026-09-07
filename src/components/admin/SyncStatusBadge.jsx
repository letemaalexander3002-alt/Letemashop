import React, { useState, useEffect, useCallback } from 'react';
import * as offline from '../../lib/offlineSync';

export function useOfflineSync(onSynced) {
  const [isOnline, setIsOnline] = useState(offline.isOnline());
  const [queue, setQueue] = useState(offline.getQueue());
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async () => {
    if (!offline.isOnline()) return;
    setSyncing(true);
    const result = await offline.processQueue();
    setSyncing(false);
    if (result.synced > 0) onSynced?.(result);
    return result;
  }, [onSynced]);

  useEffect(() => {
    const unsub = offline.subscribe(setQueue);
    const goOnline = () => { setIsOnline(true); sync(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // periodic safety-net retry every 30s in case the browser's online event is unreliable
    const interval = setInterval(() => { if (offline.isOnline()) sync(); }, 30000);
    return () => { unsub(); window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); clearInterval(interval); };
  }, [sync]);

  return { isOnline, pendingCount: queue.length, syncing, sync, enqueue: offline.enqueue };
}

export default function SyncStatusBadge({ onSynced }) {
  const { isOnline, pendingCount, syncing, sync } = useOfflineSync(onSynced);

  if (isOnline && pendingCount === 0) {
    return <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">● LIVE</span>;
  }

  return (
    <button onClick={sync} disabled={syncing || !isOnline}
      className={`text-[9px] font-mono flex items-center gap-1.5 px-2 py-1 rounded-lg ${isOnline ? 'text-amber-400 bg-amber-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
      {!isOnline ? '📴 Nje ya Mtandao' : syncing ? '🔄 Inasawazisha...' : `⏳ Ziko Kusawazishwa: ${pendingCount}`}
    </button>
  );
}
