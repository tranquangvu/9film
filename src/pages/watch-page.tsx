import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MonitorPlay, ClosedCaption, Film } from 'lucide-react';
import { VideoPlayer } from '@/components/system/player/video-player';
import { movies } from '@/data/movies';
import { Tag } from '@/components/ui/tag';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Episode } from '@/types';

// ─── Mock data ────────────────────────────────────────────────────────────────
const DEMO_SRC =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

const STREAM_SOURCES = [
  { id: 'auto', label: 'Auto', src: DEMO_SRC },
  { id: '1080p', label: '1080p HD', src: DEMO_SRC },
  { id: '720p', label: '720p', src: DEMO_SRC },
  { id: '480p', label: '480p', src: DEMO_SRC },
  { id: '360p', label: '360p', src: DEMO_SRC },
];

const SUBTITLE_TRACKS = [
  { id: 'off', label: 'Off' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'ja', label: 'Japanese' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const movie = movies.find((m) => String(m.id) === id);

  const isSeries = movie?.type === 'series';
  const availableSeasons = [...new Set((movie?.episodes ?? []).map((e) => e.season))];

  const [activeSeason, setActiveSeason] = useState(availableSeasons[0] ?? 1);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(
    movie?.episodes?.[0] ?? null,
  );
  const [selectedSourceId, setSelectedSourceId] = useState('auto');
  const [selectedSubtitleId, setSelectedSubtitleId] = useState('off');

  const selectedSource = STREAM_SOURCES.find((s) => s.id === selectedSourceId)!;
  const episodesBySeason = (movie?.episodes ?? []).filter((e) => e.season === activeSeason);

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!movie) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <p className="text-white/50 text-xl">Movie not found</p>
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
      <div className="relative w-full h-screen bg-black" style={{ '--media-border-radius': '0' } as React.CSSProperties}>
        <VideoPlayer src={selectedSource.src} poster={movie.backdrop} />

        {/* Header overlay — sits on top of the video */}
        <header className="absolute top-0 left-0 right-0 z-50 px-4 md:px-8 py-4 bg-linear-to-b from-black/70 to-transparent pointer-events-none">
          {/* Single flex row: back button + title + season/ep — all vertically centred */}
          <div className="flex items-center gap-3 pointer-events-auto min-w-0">
            {/* Back button */}
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="w-9 h-9 flex items-center justify-center rounded-full glass border border-white/15 text-zinc-300 hover:text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Movie title — shrinks but never wraps */}
            <span className="text-white font-bold text-sm md:text-base leading-none whitespace-nowrap truncate shrink min-w-0">
              {movie.title}
            </span>

            {/* Season · Episode · Episode title */}
            {isSeries && activeEpisode && (
              <>
                <span className="text-white/30 shrink-0 leading-none">·</span>
                <span className="text-white/70 text-sm font-medium shrink-0 leading-none whitespace-nowrap">
                  S{activeEpisode.season}
                </span>
                <span className="text-white/30 shrink-0 leading-none">·</span>
                <span className="text-white/70 text-sm font-medium shrink-0 leading-none whitespace-nowrap">
                  E{activeEpisode.number}
                </span>
                <span className="text-white/30 shrink-0 leading-none hidden sm:block">·</span>
                <span className="text-white/50 text-sm leading-none whitespace-nowrap truncate shrink min-w-0 hidden sm:block">
                  {activeEpisode.title}
                </span>
              </>
            )}
          </div>
        </header>
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
                  value={String(activeSeason)}
                  onChange={(e) => setActiveSeason(Number(e.target.value))}
                  options={availableSeasons.map((s) => ({ id: String(s), label: `S${s}` }))}
                />
              )}
              <div className="flex flex-wrap gap-1.5">
                {episodesBySeason.map((ep) => (
                  <Tag
                    key={ep.id}
                    active={activeEpisode?.id === ep.id}
                    onClick={() => setActiveEpisode(ep)}
                  >
                    E{ep.number}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Right: Source + Subtitle ─────────────────────────────────────── */}
          <div className="flex items-center gap-2 shrink-0">
            <Select
              icon={<MonitorPlay size={14} />}
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              options={STREAM_SOURCES}
              compact
            />
            <Select
              icon={<ClosedCaption size={14} />}
              value={selectedSubtitleId}
              onChange={(e) => setSelectedSubtitleId(e.target.value)}
              options={SUBTITLE_TRACKS}
              compact
            />
          </div>

        </div>
      </div>
    </div>
  );
}

