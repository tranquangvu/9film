import { useCallback, useState } from 'react';
import { useCredentialsQuery } from '@/hooks/queries/use-credentials-query';

export type KeyKind = 'subdl' | 'gemini';

const dismissKey = (kind: KeyKind) => `9film:key-notice-${kind}`;

// Tracks whether to prompt for a missing API key. `using` is the caller's signal
// that the feature is actually being used right now — the prompt is tied to the
// moment of use, so a key you never need is never asked for.
//
// Dismissal is remembered for the browser session: seeing it once per app run is
// a reminder, seeing it on every phrase would be nagging, and remembering it
// forever would hide the one hint that explains a quietly missing feature.
export function useMissingKey(kind: KeyKind, using: boolean) {
  const { data: credentials } = useCredentialsQuery();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(dismissKey(kind)) === '1');

  const dismiss = useCallback(() => {
    sessionStorage.setItem(dismissKey(kind), '1');
    setDismissed(true);
  }, [kind]);

  // Wait for the status to load before deciding — assuming "missing" too early
  // would flash the dialog at someone who has the key.
  const missing = credentials ? !(kind === 'subdl' ? credentials.subdlApiKeySet : credentials.geminiKeySet) : false;

  return { open: using && missing && !dismissed, missing, dismiss };
}
