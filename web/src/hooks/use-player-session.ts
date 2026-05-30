import { useCallback, useEffect, useState } from 'react';
import type { EpisodeMap } from '@/utils/episodes';
import { mergeEpisodeFromStream } from '@/utils/embed-params';
import { fetchStreamUrls, pickBestStreamUrl } from '@/utils/fetch-stream';
import {
  embedParamsFromTitle,
  fetchTitle,
  originalLanguageFromTitle,
  type ImdbTitle,
} from '@/utils/imdb';
import {
  fetchSubtitles,
  orderSubtitlesWithSelectedFirst,
  resolveSubtitleSelection,
  type SubtitleOption,
} from '@/utils/opensubtitles';
import { isImdbId, parseMediaId, type EmbedParams } from '@/utils/parse-embed-path';

export function usePlayerSession(titleId: string) {
  const [mediaParams, setMediaParams] = useState<EmbedParams | null>(null);
  const [eps, setEps] = useState<EpisodeMap | null>(null);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | undefined>();
  const [title, setTitle] = useState<string | null>(null);
  const [allUrls, setAllUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subList, setSubList] = useState<SubtitleOption[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  function applyStreamData(data: Awaited<ReturnType<typeof fetchStreamUrls>>) {
    const urls = data.stream_urls;
    setAllUrls(urls);
    setStreamUrl(urls.length ? pickBestStreamUrl(urls) : null);
    setTitle(data.title ?? null);
    setPoster(data.backdrop);
    if (data.eps && Object.keys(data.eps).length > 0) {
      setEps(data.eps);
    }
    if (data.season != null) setSeason(Number(data.season));
    if (data.episode != null) setEpisode(Number(data.episode));
  }

  const loadSubtitles = useCallback(
    async (params: EmbedParams, imdbId: string, titleDetails?: ImdbTitle) => {
      setSubLoading(true);
      setSubError(null);
      setSubList([]);
      setSelectedSubId(null);

      try {
        const titleDetailsResolved = titleDetails ?? (await fetchTitle(imdbId));
        const { code } = originalLanguageFromTitle(titleDetailsResolved);

        const rawList = await fetchSubtitles({ params, imdbId, languages: code });
        const { list, fileId } = resolveSubtitleSelection(rawList, titleDetailsResolved, params);
        setSubList(list);
        setSelectedSubId(fileId);
      } catch (err) {
        setSubList([]);
        setSelectedSubId(null);
        setSubError(err instanceof Error ? err.message : 'Failed to load subtitles');
      } finally {
        setSubLoading(false);
      }
    },
    [],
  );

  const loadStream = useCallback(
    async (params: EmbedParams, titleDetails?: ImdbTitle) => {
      const data = await fetchStreamUrls(params);
      applyStreamData(data);

      const searchParams = mergeEpisodeFromStream(params, data);
      setMediaParams(searchParams);

      const imdb =
        data.imdb_id ?? (isImdbId(searchParams.mediaId) ? searchParams.mediaId : undefined);
      if (imdb) {
        void loadSubtitles(searchParams, imdb, titleDetails);
      }
      return data;
    },
    [loadSubtitles],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Reset all player state at the start of the async function
      setError(null);
      setStreamUrl(null);
      setAllUrls([]);
      setTitle(null);
      setPoster(undefined);
      setEps(null);
      setMediaParams(null);
      setSubList([]);
      setSubError(null);
      setSelectedSubId(null);

      const mediaId = parseMediaId(titleId);
      if (!mediaId) {
        setError('Invalid IMDb ID. Expected format: tt2575988');
        return;
      }

      setLoading(true);
      try {
        const titleDetails = await fetchTitle(mediaId);
        if (cancelled) return;

        const params = embedParamsFromTitle(titleDetails, mediaId);
        setTitle(titleDetails.titleText?.text ?? null);
        setPoster(titleDetails.primaryImage?.url);
        setMediaParams(params);
        await loadStream(params, titleDetails);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load stream');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [titleId, loadStream]);

  async function handleEpisodeChange(nextSeason: number, nextEpisode: number) {
    if (!mediaParams || mediaParams.mediaType !== 'tv') return;

    setSeason(nextSeason);
    setEpisode(nextEpisode);
    setError(null);
    setLoading(true);

    const params: EmbedParams = {
      ...mediaParams,
      season: nextSeason,
      episode: nextEpisode,
    };

    try {
      await loadStream(params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load episode');
    } finally {
      setLoading(false);
    }
  }

  function handleSubtitleTrackChange(fileId: number | null) {
    setSelectedSubId(fileId);
    setSubList((prev) => orderSubtitlesWithSelectedFirst(prev, fileId));
  }

  const selectedSub = subList.find((s) => s.fileId === selectedSubId) ?? null;

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
    subLoading,
    subError,
    handleEpisodeChange,
    handleSubtitleTrackChange,
  };
}
