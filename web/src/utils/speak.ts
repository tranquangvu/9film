// Thin wrapper around the Web Speech API so components can pronounce a word
// without each re-implementing the feature-detection / cancel dance.

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, lang = 'en-US'): void {
  if (!canSpeak() || !text.trim()) return;
  // Cancel anything mid-utterance so rapid clicks don't queue up.
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
