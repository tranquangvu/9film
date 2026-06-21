import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CloudCog, Captions, Film, FileText, AlertCircle, ListVideo, CirclePlay } from 'lucide-react';
import { Tooltip } from '@videojs/react';
import { VideoPlayer } from '@/components/system/player/video-player';
import { MediaProvider } from '@/components/system/player/media-context';
import { TranscriptPanel } from '@/components/system/learn/transcript-panel';
import { WatchTour } from '@/components/system/player/watch-tour';
import { SelectField } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { usePlayerSession } from '@/hooks/use-player-session';
import { useWatchedEpisodes } from '@/hooks/queries/use-progress-query';
import { episodes, seasons } from '@/utils/stream';
import { cn } from '@/utils/cn';

export function WatchPage() {
  const { toast } = useToast();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Optional deep link from the detail-page episode selector: /watch/:id?s=1&e=3
  const seasonParam = Number(searchParams.get('s'));
  const episodeParam = Number(searchParams.get('e'));
  const initialEpisode =
    Number.isFinite(seasonParam) && seasonParam > 0 && Number.isFinite(episodeParam) && episodeParam > 0
      ? { season: seasonParam, episode: episodeParam }
      : null;

  // Optional timestamp deep link (?t=seconds) — e.g. the "watch the scene" link
  // from a saved vocabulary word. Overrides the saved resume point.
  const tParam = Number(searchParams.get('t'));
  const startAtOverride = Number.isFinite(tParam) && tParam > 0 ? tParam : undefined;

  const {
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
    handleEpisodeChange,
    handleSubtitleTrackChange,
    resumeAt,
    saveProgress,
    nextEpisode,
    autoplayNext,
    cues,
    learningMode,
    learningLang,
  } = usePlayerSession(id, initialEpisode);

  const [showTranscript, setShowTranscript] = useState(false);
  const watchedEpisodes = useWatchedEpisodes(id);
  const isSeries = eps !== null;
  const availableSeasons = eps ? seasons(eps) : [];
  const episodesBySeason = eps ? episodes(eps, season) : [];

  const learning =
    learningMode && cues.length > 0
      ? { cues, context: { imdbId: id, season: isSeries ? season : 0, episode: isSeries ? episode : 0, learningLang } }
      : null;
  const hasTranscript = learningMode && cues.length > 0;

  // On a fetch error, keep the loading UI and surface the reason via a toast.
  const blocked = !!error && !streamUrl;

  useEffect(() => {
    if (error) {
      toast({
        title: 'Failed to load content',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  return (
    <MediaProvider>
    <div className="min-h-screen bg-background text-white">
      {/* ── Video + transcript sidebar ──────────────────────────────────────── */}
      <div
        className="relative w-full h-screen bg-black flex"
        style={{ '--media-border-radius': '0' } as React.CSSProperties}
      >
        <div className="relative flex-1 min-w-0">
          <VideoPlayer
            src={streamUrl}
            loading={loading || blocked}
            poster={poster}
            subtitle={selectedSub}
            startAt={startAtOverride ?? resumeAt}
            onProgress={saveProgress}
            onEnded={() => {
              const next = nextEpisode();
              if (autoplayNext && next) handleEpisodeChange(next.season, next.episode);
            }}
            learning={learning}
          />

          {/* Header overlay — all controls sit on top of the video.
              Root is pointer-events-none (inherited) so the empty middle stays
              click-through for tap-to-pause; each cluster re-enables events. */}
          <header className="absolute top-0 inset-x-0 z-50 px-4 md:px-6 py-4 bg-linear-to-b from-black/75 via-black/30 to-transparent pointer-events-none">
            <div className="flex items-center justify-between gap-4">
              {/* Left: back · title · season/episode */}
              <div className="flex items-center gap-2 md:gap-3 pointer-events-auto min-w-0">
                <button
                  data-tour="back"
                  onClick={() => navigate(`/title/${id}`)}
                  aria-label="Back to details"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/8 border border-white/12 text-zinc-300 hover:text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <span className="text-white font-bold text-sm md:text-base leading-none truncate min-w-0">
                  {title ?? ((loading || blocked) ? '' : id)}
                </span>

                {isSeries && (availableSeasons.length > 0 || episodesBySeason.length > 0) && (
                  <span data-tour="episodes" className="inline-flex items-center gap-2 md:gap-3">
                    {availableSeasons.length > 0 && (
                      <SelectField
                        icon={<Film size={14} />}
                        size="sm"
                        value={String(season)}
                        onValueChange={(v) => handleEpisodeChange(Number(v), 1)}
                        options={availableSeasons.map((s) => ({
                          id: String(s),
                          label: `S${String(s).padStart(2, '0')}`,
                          trailing: [...watchedEpisodes].some((k) => k.startsWith(`${s}:`)) ? (
                            <span className="block w-1.5 h-1.5 rounded-full bg-orange-400" />
                          ) : undefined,
                        }))}
                        indicatorIcon={<CirclePlay className="size-4 text-orange-400" />}
                        triggerClassName="shrink-0"
                        contentClassName="bg-white/8"
                      />
                    )}
                    {episodesBySeason.length > 0 && (
                      <SelectField
                        icon={<ListVideo size={14} />}
                        size="sm"
                        value={String(episode)}
                        onValueChange={(v) => handleEpisodeChange(season, Number(v))}
                        options={episodesBySeason.map((ep) => ({
                          id: String(ep),
                          label: `E${String(ep).padStart(2, '0')}`,
                          trailing: watchedEpisodes.has(`${season}:${ep}`) ? (
                            <span className="block w-1.5 h-1.5 rounded-full bg-orange-400" />
                          ) : undefined,
                        }))}
                        indicatorIcon={<CirclePlay className="size-4 text-orange-400" />}
                        triggerClassName="shrink-0"
                        contentClassName="bg-white/8"
                      />
                    )}
                  </span>
                )}
              </div>

              {/* Right: transcript · source · subtitle */}
              <div className="flex items-center gap-2 pointer-events-auto shrink-0">
                <Tooltip.Provider>
                  {hasTranscript && (
                    <Tooltip.Root side="bottom">
                      <Tooltip.Trigger
                        render={
                          <button
                            data-tour="transcript"
                            onClick={() => setShowTranscript((v) => !v)}
                            aria-label="Toggle transcript"
                            className={cn(
                              'hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-full border transition-all',
                              showTranscript
                                ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/25'
                                : 'bg-white/8 border-white/12 text-zinc-200 hover:text-white hover:bg-white/12 hover:border-white/20',
                            )}
                          >
                            <FileText size={16} />
                          </button>
                        }
                      />
                      <Tooltip.Popup className="z-50 rounded-md border border-white/10 bg-zinc-900/95 px-2 py-1 text-xs font-medium text-white shadow-lg backdrop-blur">
                        <Tooltip.Arrow className="fill-zinc-900" />
                        {showTranscript ? 'Hide transcript' : 'Show transcript'}
                      </Tooltip.Popup>
                    </Tooltip.Root>
                  )}
                  {allUrls.length > 0 && (
                    <Tooltip.Root side="bottom">
                      <Tooltip.Trigger
                        render={
                          <span data-tour="source" className="inline-flex">
                            <SelectField
                              icon={<CloudCog size={16} />}
                              value={streamUrl ?? ''}
                              onValueChange={(v) => setStreamUrl(v)}
                              options={allUrls.map((url, i) => ({
                                id: url,
                                label: `Stream #${i + 1}`,
                              }))}
                              iconOnly
                            />
                          </span>
                        }
                      />
                      <Tooltip.Popup className="z-50 rounded-md border border-white/10 bg-zinc-900/95 px-2 py-1 text-xs font-medium text-white shadow-lg backdrop-blur">
                        <Tooltip.Arrow className="fill-zinc-900" />
                        Video source — switch if it won't play
                      </Tooltip.Popup>
                    </Tooltip.Root>
                  )}
                  {subList.length > 0 && (
                    <Tooltip.Root side="bottom">
                      <Tooltip.Trigger
                        render={
                          <span data-tour="subtitles" className="inline-flex">
                            <SelectField
                              icon={<Captions size={16} />}
                              value={selectedSubId !== null ? String(selectedSubId) : ''}
                              onValueChange={(v) => handleSubtitleTrackChange(v ? Number(v) : null)}
                              options={subList.map((s) => ({ id: String(s.fileId), label: s.label }))}
                              iconOnly
                            />
                          </span>
                        }
                      />
                      <Tooltip.Popup className="z-50 rounded-md border border-white/10 bg-zinc-900/95 px-2 py-1 text-xs font-medium text-white shadow-lg backdrop-blur">
                        <Tooltip.Arrow className="fill-zinc-900" />
                        Subtitles
                      </Tooltip.Popup>
                    </Tooltip.Root>
                  )}
                </Tooltip.Provider>
              </div>
            </div>
          </header>

          {(loading || blocked) && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden">
              {poster && (
                <img
                  src={poster}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-cover opacity-30 blur-2xl scale-110"
                />
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black via-black/70 to-black/50" />
              <div className="relative flex flex-col items-center gap-5 px-6 text-center">
                {blocked ? (
                  <AlertCircle className="w-12 h-12 text-orange-400/80" />
                ) : (
                  <div className="w-12 h-12 rounded-full border-[3px] border-white/15 border-t-orange-500 animate-spin" />
                )}
                <div>
                  <p className="text-white font-semibold text-base md:text-lg leading-tight">
                    {title ?? 'Loading'}
                  </p>
                  <p className="text-white/55 text-sm mt-1.5">
                    {blocked ? (error ?? 'Unable to load stream') : 'Preparing your stream…'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* First-use spotlight tour — activates once the player is ready so the
              highlighted controls are on screen; self-hides after completion. */}
          <WatchTour enabled={!loading && !blocked && !!streamUrl} />
        </div>

        {/* Transcript sidebar — full-screen overlay on mobile, side column on desktop */}
        {hasTranscript && showTranscript && (
          <aside className="hidden sm:flex absolute inset-y-0 right-0 z-50 w-full sm:static sm:w-72 shrink-0 flex-col border-l border-white/[0.06] bg-zinc-950 backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-orange-600/7 via-orange-950/[0.03] to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-radial-[at_bottom_right] from-amber-500/6 via-transparent to-transparent to-60%" />
            <div className="relative flex-1 min-h-0 flex flex-col">
              <TranscriptPanel cues={cues} />
            </div>
          </aside>
        )}
      </div>
    </div>
    </MediaProvider>
  );
}
