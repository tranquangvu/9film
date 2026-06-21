import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  bestUrl,
  isImdb,
  mergeEpisode,
  parseId,
  seasons,
  episodes,
  type EmbedParams,
  type EpisodeMap,
} from '@/utils/stream';
import { embedParams } from '@/utils/title';
import { orderSubs, pickSubs } from '@/utils/subtitle';
import { getSubtitlePref, setSubtitlePref } from '@/utils/subtitle-pref';
import { useAuth } from '@/context/auth-context';
import { useTitleQuery } from './queries/use-title-query';
import { useStreamQuery } from './queries/use-stream-query';
import { useSubtitlesQuery } from './queries/use-subtitles-query';
import { useSubtitleCues } from './queries/use-subtitle-cues';
import { useSaveProgress } from './queries/use-progress-query';
import { useSaveSubtitle } from './queries/use-subtitle-query';
import { useSettings } from './queries/use-settings-query';

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

  // ── Watch progress (resume + save) ──────────────────────────────────────────
  const { isAuthenticated } = useAuth();
  const settings = useSettings();
  // Per-title resume points ride along in the title detail response.
  const progressItems = titleData?.progress ?? [];
  const saveProgressMut = useSaveProgress();

  // Reliable "is this a series?" signal derived from title metadata — available
  // before the `eps` map (a separate stream request) resolves, so early saves
  // and resume decisions don't mistakenly treat a series as a movie.
  const isTv = baseParams?.mediaType === 'tv';

  // Most-recently-watched row for this title (the API orders progress
  // newest-first), used to seed which episode a series resumes into.
  const lastWatched = useMemo(() => progressItems[0] ?? null, [progressItems]);

  // For a series opened without a deep link, resume on the last-watched episode.
  const seriesResume = useMemo(() => {
    if (initialEpisode) return null;
    if (isTv && lastWatched && lastWatched.season > 0) {
      return { season: lastWatched.season, episode: lastWatched.episode };
    }
    return null;
  }, [initialEpisode, isTv, lastWatched]);

  // Effective episode: an explicit user pick wins, else the series-resume seed.
  const effectiveSelected = selected ?? seriesResume;

  // The playable stream: bare for movies / no selection, episode-specific once picked.
  const streamParams = useMemo<EmbedParams | null>(() => {
    if (!baseParams) return null;
    if (baseParams.mediaType === 'tv' && effectiveSelected) {
      return { ...baseParams, season: effectiveSelected.season, episode: effectiveSelected.episode };
    }
    return baseParams;
  }, [baseParams, effectiveSelected]);

  const streamQuery = useStreamQuery(streamParams);
  const streamData = streamQuery.data;

  const allUrls = useMemo(() => streamData?.stream_urls ?? [], [streamData]);
  const autoStreamUrl = useMemo(
    () => (allUrls.length > 0 ? bestUrl(allUrls) : null),
    [allUrls],
  );
  const streamUrl = userStreamUrl ?? autoStreamUrl;

  // Reset per-title state when navigating to a different title or deep-link target.
  // (Intentional reset-on-navigation; setState here is the simplest correct form.)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSelected(
      initialSeason != null && initialEp != null
        ? { season: initialSeason, episode: initialEp }
        : null,
    );
    setStreamUrl(null);
    setUserSubId(null);
  }, [titleId, initialSeason, initialEp]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Displayed/selected episode: the effective pick, falling back to the upstream default.
  const season = effectiveSelected?.season ?? (streamData?.season != null ? Number(streamData.season) : 1);
  const episode = effectiveSelected?.episode ?? (streamData?.episode != null ? Number(streamData.episode) : 1);

  // Resume position for the episode actually being shown. Series progress is
  // keyed by season+episode so each episode keeps its own resume point; movies
  // have a single row per title (season/episode 0).
  const currentProgress = useMemo(() => {
    return isTv
      ? progressItems.find((p) => p.season === season && p.episode === episode) ?? null
      : progressItems.find((p) => p.season === 0) ?? null;
  }, [progressItems, isTv, season, episode]);

  const resumeAt =
    isAuthenticated &&
    currentProgress &&
    currentProgress.positionSeconds > 5 &&
    currentProgress.durationSeconds > 0 &&
    currentProgress.positionSeconds < currentProgress.durationSeconds * 0.95
      ? currentProgress.positionSeconds
      : undefined;

  const saveProgress = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      if (!isAuthenticated) return;
      saveProgressMut.mutate({
        imdbId: titleId,
        season: isTv ? season : 0,
        episode: isTv ? episode : 0,
        positionSeconds,
        durationSeconds,
      });
    },
    [isAuthenticated, titleId, isTv, season, episode, saveProgressMut],
  );

  // Next episode in the eps map (drives autoplay-next).
  const nextEpisode = useCallback((): { season: number; episode: number } | null => {
    if (!eps) return null;
    const epList = episodes(eps, season);
    const idx = epList.indexOf(episode);
    if (idx >= 0 && idx + 1 < epList.length) {
      return { season, episode: epList[idx + 1] };
    }
    const seasonList = seasons(eps);
    const sIdx = seasonList.indexOf(season);
    if (sIdx >= 0 && sIdx + 1 < seasonList.length) {
      const nextSeason = seasonList[sIdx + 1];
      const nextEps = episodes(eps, nextSeason);
      if (nextEps.length > 0) return { season: nextSeason, episode: nextEps[0] };
    }
    return null;
  }, [eps, season, episode]);

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
    return pickSubs(subtitleQuery.data, titleData, resolvedStreamParams, settings.defaultSubtitleLang);
  }, [subtitleQuery.data, titleData, resolvedStreamParams, settings.defaultSubtitleLang]);

  const autoSubId = resolvedSubs?.fileId ?? null;

  // Saved selection for this title. For signed-in users it rides along in the
  // title detail (DB-backed, follows them across devices); otherwise we fall back
  // to localStorage.
  const saveSubtitleMut = useSaveSubtitle();
  // Per-episode (DB-backed, follows the signed-in user across devices), falling
  // back to the title-scoped localStorage pref for anonymous users.
  const savedSubPref = useMemo(
    () => currentProgress?.subtitlePref ?? getSubtitlePref(titleId),
    [currentProgress?.subtitlePref, titleId],
  );

  // Prefer the exact release (fileId), else any track in the same language.
  const prefSubId = useMemo(() => {
    if (!resolvedSubs || !savedSubPref) return null;
    const match =
      resolvedSubs.list.find((s) => s.fileId === savedSubPref.fileId) ??
      resolvedSubs.list.find((s) => s.language === savedSubPref.language);
    return match?.fileId ?? null;
  }, [resolvedSubs, savedSubPref]);

  // In-session pick wins; then the persisted preference; then the auto pick.
  const selectedSubId = userSubId ?? prefSubId ?? autoSubId;

  const subList = useMemo(
    () => orderSubs(resolvedSubs?.list ?? [], selectedSubId),
    [resolvedSubs, selectedSubId],
  );

  function handleEpisodeChange(nextSeason: number, nextEpisode: number) {
    setSelected({ season: nextSeason, episode: nextEpisode });
    setStreamUrl(null);
    setUserSubId(null);
  }

  function handleSubtitleTrackChange(fileId: number | null) {
    setUserSubId(fileId);
    const opt = fileId != null ? resolvedSubs?.list.find((s) => s.fileId === fileId) : null;
    const pref = opt ? { fileId: opt.fileId, language: opt.language } : null;
    setSubtitlePref(titleId, pref); // localStorage (instant + offline fallback)
    if (isAuthenticated && pref) {
      saveSubtitleMut.mutate({
        imdbId: titleId,
        season: isTv ? season : 0,
        episode: isTv ? episode : 0,
        ...pref,
      });
    }
  }

  const selectedSub = subList.find((s) => s.fileId === selectedSubId) ?? null;

  // Parsed subtitle cues drive the interactive overlay + transcript panel. Only
  // fetched/parsed when learning mode is on; reuses the browser-cached VTT file.
  const cuesQuery = useSubtitleCues(settings.learningMode ? selectedSubId : null);
  const cues = useMemo(() => cuesQuery.data ?? [], [cuesQuery.data]);

  const poster = streamData?.backdrop ?? titleData?.poster;
  // Prefer the clean IMDb title (just the name) — the upstream stream title often
  // bakes in the release year (e.g. "Silicon Valley 2014").
  const title = titleData?.title ?? streamData?.title ?? null;

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
    resumeAt,
    saveProgress,
    nextEpisode,
    autoplayNext: settings.autoplayNext,
    cues,
    learningMode: settings.learningMode,
    learningLang: settings.learningLang,
  };
}
