import { useCallback, useEffect, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';

export function usePublicMatch({ matchId, selfId, onEvent }) {
  const channelRef = useRef(null);

  useEffect(() => {
    if (!matchId || !selfId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase.channel(`public-match:${matchId}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'battle-event' }, ({ payload }) => {
      if (!payload || payload.from === selfId) return;
      onEvent?.(payload);
    });

    channel.subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [matchId, onEvent, selfId]);

  const sendEvent = useCallback((type, data = {}) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'battle-event',
      payload: {
        type,
        from: selfId,
        at: Date.now(),
        ...data,
      },
    });
  }, [selfId]);

  return { sendEvent };
}
