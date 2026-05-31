import { useMemo, useState } from 'react';
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
import { useTitleQuery } from './use-title-query';
import { useStreamQuery } from './use-stream-query';
import { useSubtitlesQuery } from './use-subtitles-query';

export function usePlayerSession(titleId: string) {
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
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

  const streamParams = useMemo<EmbedParams | null>(
    () => (baseParams ? { ...baseParams, season, episode } : null),
    [baseParams, season, episode],
  );

  const streamQuery = useStreamQuery(streamParams);
  const streamData = streamQuery.data;

  const allUrls = useMemo(() => streamData?.stream_urls ?? [], [streamData]);
  const autoStreamUrl = useMemo(
    () => (allUrls.length > 0 ? bestUrl(allUrls) : null),
    [allUrls],
  );
  const streamUrl = userStreamUrl ?? autoStreamUrl;

  const eps = useMemo<EpisodeMap | null>(() => {
    if (streamData?.eps && Object.keys(streamData.eps).length > 0) return streamData.eps;
    return null;
  }, [streamData]);

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
    setSeason(nextSeason);
    setEpisode(nextEpisode);
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
