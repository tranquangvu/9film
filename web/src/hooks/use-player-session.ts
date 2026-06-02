import { useEffect, useMemo, useState } from 'react';
import {
  bestUrl,
  isImdb,
  mergeEpisode,
  parseId,
  type EmbedParams,
  type EpisodeMap,
} from '@/utils/stream';
import { embedParams } from '@/utils/title';
import { orderSubs, pickSubs } from '@/utils/subtitle';
import { useTitleQuery } from './queries/use-title-query';
import { useStreamQuery } from './queries/use-stream-query';
import { useSubtitlesQuery } from './queries/use-subtitles-query';

export function usePlayerSession(titleId: string) {
  // The user's explicit episode pick. Null until they choose one — the initial
  // TV request is deliberately "bare" so the upstream returns the season→episode map.
  const [selected, setSelected] = useState<{ season: number; episode: number } | null>(null);
  const [eps, setEps] = useState<EpisodeMap | null>(null);
  const [userStreamUrl, setStreamUrl] = useState<string | null>(null);
  const [userSubId, setUserSubId] = useState<number | null>(null);

  const mediaId = parseId(titleId);

  // 1. Title
  const titleQuery = useTitleQuery(titleId);
  const titleData = titleQuery.data;

  // 2. Stream — re-fetches automatically when season/episode change
  const baseParams = useMemo<EmbedParams | null>(
    () => (titleData ? embedParams(titleData, mediaId ?? titleId) : null),
    [titleData, mediaId, titleId],
  );

  // The upstream only returns the full `eps` season→episode map on a request that
  // omits season/episode (which also yields a default playable episode). So we keep
  // the first TV request bare and only target a specific episode once the user picks one.
  const streamParams = useMemo<EmbedParams | null>(() => {
    if (!baseParams) return null;
    if (baseParams.mediaType === 'tv' && selected) {
      return { ...baseParams, season: selected.season, episode: selected.episode };
    }
    return baseParams;
  }, [baseParams, selected]);

  const streamQuery = useStreamQuery(streamParams);
  const streamData = streamQuery.data;

  const allUrls = useMemo(() => streamData?.stream_urls ?? [], [streamData]);
  const autoStreamUrl = useMemo(
    () => (allUrls.length > 0 ? bestUrl(allUrls) : null),
    [allUrls],
  );
  const streamUrl = userStreamUrl ?? autoStreamUrl;

  // `eps` only arrives on the bare request, so persist it across the per-episode
  // requests (which omit it) rather than deriving it from the latest response.
  useEffect(() => {
    if (streamData?.eps && Object.keys(streamData.eps).length > 0) {
      setEps(streamData.eps);
    }
  }, [streamData]);

  // Reset per-title state when navigating to a different title.
  useEffect(() => {
    setSelected(null);
    setEps(null);
    setStreamUrl(null);
    setUserSubId(null);
  }, [titleId]);

  // Displayed/selected episode: the user's pick, falling back to the upstream default.
  const season = selected?.season ?? (streamData?.season != null ? Number(streamData.season) : 1);
  const episode = selected?.episode ?? (streamData?.episode != null ? Number(streamData.episode) : 1);

  // 3. Subtitles — depends on resolved stream params + title language
  const resolvedStreamParams = useMemo<EmbedParams | null>(
    () => (streamData && streamParams ? mergeEpisode(streamParams, streamData) : null),
    [streamData, streamParams],
  );

  const imdbId =
    streamData?.imdb_id ??
    (baseParams && isImdb(baseParams.mediaId) ? baseParams.mediaId : null);

  const subtitleQuery = useSubtitlesQuery(resolvedStreamParams, imdbId, titleData);

  const resolvedSubs = useMemo(() => {
    if (!subtitleQuery.data || !titleData || !resolvedStreamParams) return null;
    return pickSubs(subtitleQuery.data, titleData, resolvedStreamParams);
  }, [subtitleQuery.data, titleData, resolvedStreamParams]);

  const autoSubId = resolvedSubs?.fileId ?? null;
  const selectedSubId = userSubId ?? autoSubId;

  const subList = useMemo(
    () => orderSubs(resolvedSubs?.list ?? [], selectedSubId),
    [resolvedSubs, selectedSubId],
  );

  // Handlers
  function handleEpisodeChange(nextSeason: number, nextEpisode: number) {
    setSelected({ season: nextSeason, episode: nextEpisode });
    setStreamUrl(null);
    setUserSubId(null);
  }

  function handleSubtitleTrackChange(fileId: number | null) {
    setUserSubId(fileId);
  }

  const selectedSub = subList.find((s) => s.fileId === selectedSubId) ?? null;

  const poster = streamData?.backdrop ?? titleData?.primaryImage?.url;
  const title = streamData?.title ?? titleData?.titleText?.text ?? null;

  const loading = titleQuery.isLoading || streamQuery.isFetching;
  const error =
    (titleQuery.error instanceof Error ? titleQuery.error.message : null) ??
    (streamQuery.error instanceof Error ? streamQuery.error.message : null) ??
    (!mediaId ? 'Invalid IMDb ID. Expected format: tt2575988' : null);

  return {
    titleId,
    eps,
    season,
    episode,
    streamUrl,
    setStreamUrl,
    poster,
    title,
    allUrls,
    loading,
    error,
    subList,
    selectedSubId,
    selectedSub,
    subLoading: subtitleQuery.isFetching,
    subError: subtitleQuery.error instanceof Error ? subtitleQuery.error.message : null,
    handleEpisodeChange,
    handleSubtitleTrackChange,
  };
}
