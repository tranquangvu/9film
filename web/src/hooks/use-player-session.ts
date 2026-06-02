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

export function usePlayerSession(
  titleId: string,
  initialEpisode?: { season: number; episode: number } | null,
) {
  const initialSeason = initialEpisode?.season ?? null;
  const initialEp = initialEpisode?.episode ?? null;

  // The user's explicit episode pick. May be seeded from a deep link (e.g. the
  // detail-page episode selector); otherwise null so the first TV request stays bare.
  const [selected, setSelected] = useState<{ season: number; episode: number } | null>(
    initialSeason != null && initialEp != null
      ? { season: initialSeason, episode: initialEp }
      : null,
  );
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

  // The `eps` season→episode map only comes back on a request that omits
  // season/episode, so fetch it from a dedicated bare request (series only). With no
  // episode selected this is the same query as the stream below, so it's deduped.
  const epsParams = useMemo<EmbedParams | null>(
    () => (baseParams?.mediaType === 'tv' ? baseParams : null),
    [baseParams],
  );
  const epsQuery = useStreamQuery(epsParams);
  const eps = useMemo<EpisodeMap | null>(() => {
    const map = epsQuery.data?.eps;
    return map && Object.keys(map).length > 0 ? map : null;
  }, [epsQuery.data]);

  // The playable stream: bare for movies / no selection, episode-specific once picked.
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

  // Reset per-title state when navigating to a different title or deep-link target.
  useEffect(() => {
    setSelected(
      initialSeason != null && initialEp != null
        ? { season: initialSeason, episode: initialEp }
        : null,
    );
    setStreamUrl(null);
    setUserSubId(null);
  }, [titleId, initialSeason, initialEp]);

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
