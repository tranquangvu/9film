/** API shape: `{ "1": ["1","2",...], "2": [...] }` */
export type EpisodeMap = Record<string, string[]>;

export function getSortedSeasons(eps: EpisodeMap): number[] {
  return Object.keys(eps)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
}

export function getEpisodesForSeason(eps: EpisodeMap, season: number): number[] {
  const list = eps[String(season)] ?? [];
  return list.map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
}
