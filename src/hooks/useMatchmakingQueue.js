import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';

function createLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getWaitingPlayersFromPresence(presenceState) {
  const waiting = [];
  Object.values(presenceState || {}).forEach((metas) => {
    if (!Array.isArray(metas)) return;
    metas.forEach((meta) => {
      if (meta?.status === 'waiting' && meta?.userId) {
        waiting.push(meta);
      }
    });
  });
  return waiting.sort((a, b) => {
    if (a.joinedAt === b.joinedAt) return a.userId.localeCompare(b.userId);
    return Number(a.joinedAt) - Number(b.joinedAt);
  });
}

export function useMatchmakingQueue({ username, aura }) {
  const userId = useMemo(() => createLocalId(), []);
  const [status, setStatus] = useState('idle');
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);
  const lockedMatchRef = useRef(false);

  const leaveQueue = useCallback(async () => {
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    lockedMatchRef.current = false;
    setStatus('idle');
  }, []);

  const startQueue = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
      setStatus('error');
      return;
    }

    setError(null);
    setMatch(null);
    setStatus('searching');
    lockedMatchRef.current = false;

    const channel = supabase.channel('public-matchmaking', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channelRef.current = channel;

    channel.on('broadcast', { event: 'match-found' }, ({ payload }) => {
      if (lockedMatchRef.current || !payload) return;
      const includesSelf = payload.playerA?.userId === userId || payload.playerB?.userId === userId;
      if (!includesSelf) return;
      lockedMatchRef.current = true;
      setMatch(payload);
      setStatus('matched');
    });

    channel.on('presence', { event: 'sync' }, () => {
      if (lockedMatchRef.current) return;
      const waiting = getWaitingPlayersFromPresence(channel.presenceState());
      if (waiting.length < 2) return;

      for (let i = 0; i + 1 < waiting.length; i += 2) {
        const playerA = waiting[i];
        const playerB = waiting[i + 1];
        const pairContainsSelf = playerA.userId === userId || playerB.userId === userId;
        if (!pairContainsSelf) continue;

        const hostId = [playerA.userId, playerB.userId].sort()[0];
        if (hostId !== userId) return;

        const payload = {
          matchId: `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          playerA,
          playerB,
          hostId,
        };
        lockedMatchRef.current = true;
        setMatch(payload);
        setStatus('matched');
        channel.send({
          type: 'broadcast',
          event: 'match-found',
          payload,
        });
        return;
      }
    });

    channel.subscribe(async (subscriptionStatus) => {
      if (subscriptionStatus !== 'SUBSCRIBED') return;
      await channel.track({
        userId,
        username,
        aura,
        status: 'waiting',
        joinedAt: Date.now(),
      });
    });
  }, [aura, userId, username]);

  useEffect(() => () => {
    if (channelRef.current) channelRef.current.unsubscribe();
  }, []);

  return {
    userId,
    status,
    match,
    error,
    startQueue,
    leaveQueue,
  };
}
