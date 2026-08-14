import { useCallback, useState } from 'react';

// Set once the notice has been acknowledged. Unlike the missing-key prompts
// (sessionStorage — they hint at a feature that is quietly off, so they are
// worth repeating), this is a one-time statement of what the app is: seen once,
// it stays acknowledged.
const ACK_KEY = '9film:watch-notice-ack';

/**
 * Gate for the content notice shown before the first playback ever: no licence,
 * nothing hosted here, personal non-commercial use only. `pending` stays true
 * until it is acknowledged, and the watch page holds the stream back that long
 * so nothing plays behind it.
 */
export function useWatchNotice() {
  const [acknowledged, setAcknowledged] = useState(() => localStorage.getItem(ACK_KEY) === '1');

  const acknowledge = useCallback(() => {
    localStorage.setItem(ACK_KEY, '1');
    setAcknowledged(true);
  }, []);

  return { pending: !acknowledged, acknowledge };
}
