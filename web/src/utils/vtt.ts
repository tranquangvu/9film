// Minimal WebVTT parser. The backend already serves VTT (converted from SRT) at
// /api/subtitle/download?file_id=…; we parse it into timed cues so the player can
// render an interactive, clickable transcript synced to playback.

export interface Cue {
  start: number; // seconds
  end: number; // seconds
  text: string; // cue text, tags stripped, newlines collapsed to spaces
}

// "00:01:23.456" or "01:23.456" → seconds
function parseTimestamp(raw: string): number {
  const parts = raw.trim().split(':');
  if (parts.length < 2) return NaN;
  const secs = parts.pop()!.replace(',', '.');
  const mins = parts.pop()!;
  const hours = parts.length ? parts.pop()! : '0';
  return Number(hours) * 3600 + Number(mins) * 60 + Number(secs);
}

const TIMING_RE = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/;

function stripTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // <i>, <c>, <00:00:00.000> word timings, etc.
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseVtt(input: string): Cue[] {
  const cues: Cue[] = [];
  // Normalise line endings; split into blocks on blank lines.
  const blocks = input.replace(/\r\n?/g, '\n').split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    // Find the line that holds the "start --> end" timing.
    const timingIdx = lines.findIndex((l) => TIMING_RE.test(l));
    if (timingIdx === -1) continue;

    const timingLine = lines[timingIdx];
    const [startRaw, rest] = timingLine.split('-->');
    const endRaw = (rest ?? '').trim().split(/\s+/)[0]; // drop cue settings after the timestamp
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    const text = stripTags(lines.slice(timingIdx + 1).join(' '));
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

// Binary search for the cue active at time t (seconds); -1 if none.
export function activeCueIndex(cues: Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cue = cues[mid];
    if (t < cue.start) hi = mid - 1;
    else if (t > cue.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}
