import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MonitorPlay, ClosedCaption, Film } from 'lucide-react';
import { VideoPlayer } from '@/components/system/player/video-player';
import { Tag } from '@/components/ui/tag';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { usePlayerSession } from '@/hooks/use-player-session';
import { episodes, seasons } from '@/utils/stream';

// ─── Page ─────────────────────────────────────────────────────────────────────
export function WatchPage() {
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
  } = usePlayerSession(id, initialEpisode);

  const isSeries = eps !== null;
  const availableSeasons = eps ? seasons(eps) : [];
  const episodesBySeason = eps ? episodes(eps, season) : [];

  // ── Error / not-found state ────────────────────────────────────────────────
  if (error && !streamUrl) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <p className="text-white/50 text-xl">{error}</p>
        <Button variant="primary" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      {/* ── Video + overlaid header ─────────────────────────────────────────── */}
      <div
        className="relative w-full h-screen bg-black"
        style={{ '--media-border-radius': '0' } as React.CSSProperties}
      >
        <VideoPlayer src={streamUrl} poster={poster} subtitle={selectedSub} />

        {/* Header overlay — sits on top of the video */}
        <header className="absolute top-0 left-0 right-0 z-50 px-4 md:px-8 py-4 bg-linear-to-b from-black/70 to-transparent pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto min-w-0">
            {/* Back button */}
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="w-9 h-9 flex items-center justify-center rounded-full glass border border-white/15 text-zinc-300 hover:text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Movie / show title */}
            <span className="text-white font-bold text-sm md:text-base leading-none whitespace-nowrap truncate shrink min-w-0">
              {loading && !title ? 'Loading…' : (title ?? id)}
            </span>

            {/* Season · Episode */}
            {isSeries && (
              <>
                <span className="text-white/30 shrink-0 leading-none">·</span>
                <span className="text-white/70 text-sm font-medium shrink-0 leading-none whitespace-nowrap">
                  S{season}
                </span>
                <span className="text-white/30 shrink-0 leading-none">·</span>
                <span className="text-white/70 text-sm font-medium shrink-0 leading-none whitespace-nowrap">
                  E{episode}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Loading indicator */}
        {loading && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 text-white/50 text-sm">
            Loading stream…
          </div>
        )}
      </div>

      {/* ── Below-video panel ──────────────────────────────────────────────── */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-end gap-8">

          {/* Left: Season + Episodes ──────────────────────────────────────── */}
          {isSeries && (
            <div className="flex-1 min-w-0 flex items-start gap-3 flex-wrap">
              {availableSeasons.length > 0 && (
                <Select
                  icon={<Film size={14} />}
                  value={String(season)}
                  onChange={(e) => handleEpisodeChange(Number(e.target.value), 1)}
                  options={availableSeasons.map((s) => ({ id: String(s), label: `S${s}` }))}
                />
              )}
              <div className="flex flex-wrap gap-1.5">
                {episodesBySeason.map((ep) => (
                  <Tag
                    key={ep}
                    active={episode === ep}
                    onClick={() => handleEpisodeChange(season, ep)}
                  >
                    E{ep}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Right: Source + Subtitle ─────────────────────────────────────── */}
          <div className="flex items-center gap-2 shrink-0">
            {allUrls.length > 0 && (
              <Select
                icon={<MonitorPlay size={14} />}
                value={streamUrl ?? ''}
                onChange={(e) => setStreamUrl(e.target.value)}
                options={allUrls.map((url, i) => ({
                  id: url,
                  label: `Source ${i + 1}${url.includes('master.m3u8') ? ' (adaptive)' : ''}`,
                }))}
                compact
              />
            )}
            {subList.length > 0 && (
              <Select
                icon={<ClosedCaption size={14} />}
                value={selectedSubId !== null ? String(selectedSubId) : ''}
                onChange={(e) =>
                  handleSubtitleTrackChange(e.target.value ? Number(e.target.value) : null)
                }
                options={subList.map((s) => ({ id: String(s.fileId), label: s.label }))}
                compact
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
