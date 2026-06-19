import type { EmbedParams } from './stream';
import type { Title } from './title';

const LIMIT = 5;

export interface SubtitleOption {
  fileId: number;
  language: string;
  label: string;
  downloadCount: number;
  release: string;
}

export interface SubtitleSearchContext {
  params: EmbedParams;
  imdbId?: string;
  languages?: string;
}

export function pickSubs(
  subs: SubtitleOption[],
  title: Title,
  params: EmbedParams,
  preferredLang?: string,
): { list: SubtitleOption[]; fileId: number | null } {
  const sorted = [...subs].sort((a, b) => b.downloadCount - a.downloadCount);
  if (!sorted.length) return { list: [], fileId: null };

  // If the user has a preferred subtitle language and any match it, choose the
  // default from that pool; otherwise fall back to the most-downloaded overall.
  const langPool = preferredLang
    ? sorted.filter((s) => s.language?.toLowerCase().startsWith(preferredLang.toLowerCase()))
    : [];
  const pool = langPool.length ? langPool : sorted;

  let fileId = pool[0].fileId;
  const name = title.title?.trim();

  if (name) {
    const base = name.replace(/\s+/g, '.');
    let pattern = base;

    if (params.mediaType === 'tv' && params.season != null && params.episode != null) {
      const s = String(params.season).padStart(2, '0');
      const e = String(params.episode).padStart(2, '0');
      pattern = `${base}.S${s}E${e}`;
    } else if (title.year) {
      pattern = `${base}.${title.year}`;
    }

    const pl = pattern.toLowerCase();
    const matches = pool.filter((s) => s.release.toLowerCase().includes(pl));
    if (matches.length) {
      fileId = (matches.find((s) => s.release.toLowerCase().includes('.bluray')) ?? matches[0]).fileId;
    }
  }

  const top = sorted.slice(0, LIMIT);
  const selected = sorted.find((s) => s.fileId === fileId);
  const list = selected
    ? [selected, ...top.filter((s) => s.fileId !== fileId)].slice(0, LIMIT)
    : top;

  return { list, fileId };
}

export function orderSubs(subs: SubtitleOption[], fileId: number | null): SubtitleOption[] {
  if (fileId == null) return subs;

  const selected = subs.find((s) => s.fileId === fileId);
  if (!selected) return subs;

  return [selected, ...subs.filter((s) => s.fileId !== fileId)].slice(0, LIMIT);
}
