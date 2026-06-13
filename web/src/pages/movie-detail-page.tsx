import { useState, useRef, useMemo, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play,
  Heart,
  Share2,
  ArrowLeft,
  Star,
  Clock,
  MapPin,
  Layers,
} from "lucide-react";
import { useTitleQuery } from "@/hooks/queries/use-title-query";
import { useSimilarQuery } from "@/hooks/queries/use-similar-query";
import { useStreamQuery } from "@/hooks/queries/use-stream-query";
import { toMovie, toMovies, embedParams } from "@/utils/title";
import { seasons, episodes, type EmbedParams } from "@/utils/stream";
import { cn } from "@/utils/cn";
import { formatDuration, formatRating, formatYear } from "@/utils/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tag } from "@/components/ui/tag";
import { MovieCard } from "@/components/system/movie/movie-card";
import { GenreBadge } from "@/components/system/movie/genre-badge";
import { DetailPageSkeleton } from "@/components/system/movie/skeletons";
import { useListButton } from "@/hooks/queries/use-list-query";
import { useWatchedEpisodes } from "@/hooks/queries/use-progress-query";

export default function MovieDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const titleQuery = useTitleQuery(id);
  const similarQuery = useSimilarQuery(id);
  const movie = titleQuery.data ? toMovie(titleQuery.data) : null;
  const similarMovies = toMovies(similarQuery.data ?? []);

  // For series, fetch the season→episode map (a bare stream request) so the
  // episode selector can offer real per-season episodes.
  const seriesParams = useMemo<EmbedParams | null>(() => {
    if (!titleQuery.data) return null;
    const params = embedParams(titleQuery.data, id);
    return params.mediaType === "tv" ? params : null;
  }, [titleQuery.data, id]);
  const epsQuery = useStreamQuery(seriesParams);
  const eps = useMemo(() => {
    const map = epsQuery.data?.eps;
    return map && Object.keys(map).length > 0 ? map : null;
  }, [epsQuery.data]);

  // All title images from the images connection — deduped.
  const galleryImages = useMemo<string[]>(() => {
    const title = titleQuery.data;
    if (!title) return [];
    const urls = (
      title.images?.edges?.map((edge) => edge?.node?.url) ?? []
    ).filter((url): url is string => !!url);
    return [...new Set(urls)];
  }, [titleQuery.data]);

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [shareTooltip, setShareTooltip] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // The image currently shown as the opaque base layer. The active image fades
  // in on top of it; once the fade finishes, it becomes the new base. Keeping a
  // fully-opaque layer underneath avoids the mid-crossfade darkening dip.
  const [baseImageIndex, setBaseImageIndex] = useState(0);

  const favorite = useListButton(id, movie?.type ?? "movie");
  const watchedEpisodes = useWatchedEpisodes(id);

  useEffect(() => {
    if (galleryImages.length < 2) return;
    const timer = setInterval(() => {
      setActiveImageIndex((i) => (i + 1) % galleryImages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [galleryImages.length]);

  useEffect(() => {
    if (titleQuery.isError) {
      toast({
        title: "Failed to load content",
        description: "Could not load title details. Please try again.",
        variant: "destructive",
      });
    }
  }, [titleQuery.isError, toast]);

  if (titleQuery.isLoading || titleQuery.isError) {
    return <DetailPageSkeleton />;
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="text-6xl">🎬</div>
        <h1 className="text-3xl font-bold text-white">Movie not found</h1>
        <p className="text-zinc-400">
          We couldn't find that title in our library.
        </p>
        <Button variant="primary" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setShareTooltip(true);
    setTimeout(() => setShareTooltip(false), 2000);
  };

  const availableSeasons = eps ? seasons(eps) : [];
  // Fall back to the first available season if the picked one isn't in the map.
  const activeSeason = availableSeasons.includes(selectedSeason)
    ? selectedSeason
    : (availableSeasons[0] ?? 1);
  const episodeList = eps ? episodes(eps, activeSeason) : [];

  return (
    <div className="min-h-screen bg-background text-white">
      {/* ── HERO SECTION ── */}
      <div ref={heroRef} className="relative w-full h-screen overflow-hidden">
        {/* Backdrop — crossfades through gallery images. The base layer always
            stays fully opaque while the incoming image fades in on top, so the
            composite never dips to the (dark) background mid-transition. */}
        <div className="absolute inset-0 bg-black">
          <img
            key={`base-${galleryImages[baseImageIndex] ?? movie.backdrop}`}
            src={galleryImages[baseImageIndex] ?? movie.backdrop}
            alt={movie.title}
            draggable={false}
            className="absolute inset-0 object-cover w-full h-full"
          />
          {activeImageIndex !== baseImageIndex && (
            <motion.img
              key={`top-${galleryImages[activeImageIndex] ?? movie.backdrop}`}
              src={galleryImages[activeImageIndex] ?? movie.backdrop}
              alt={movie.title}
              draggable={false}
              className="absolute inset-0 object-cover w-full h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              onAnimationComplete={() => setBaseImageIndex(activeImageIndex)}
            />
          )}
        </div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 gradient-overlay" />
        <div className="absolute inset-0 gradient-overlay-right" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-black/30" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className={cn(
            buttonVariants({ variant: "icon", size: "icon" }),
            "absolute top-24 left-4 md:top-24 md:left-8 lg:left-12 z-20",
          )}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-28 md:px-8 lg:px-12 max-w-4xl">
          {/* Genre badges */}
          <div className="flex flex-wrap gap-2 mb-2">
            {movie.genres.map((genre) => (
              <GenreBadge key={genre} genre={genre} />
            ))}
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-3 drop-shadow-2xl">
            {movie.title}
          </h1>

          {/* Tagline */}
          {movie.tagline && (
            <p className="text-lg text-zinc-300 italic mb-5 drop-shadow-lg">
              "{movie.tagline}"
            </p>
          )}

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-7 text-sm text-zinc-300">
            <span className="font-semibold text-white">
              {formatYear(movie.year)}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              {formatDuration(movie.duration)}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              {movie.country}
            </span>
            {movie.type === "series" &&
              (movie.totalSeasons || movie.totalEpisodes) && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                    {movie.totalSeasons != null && (
                      <>
                        {movie.totalSeasons}{" "}
                        {movie.totalSeasons === 1 ? "Season" : "Seasons"}
                      </>
                    )}
                    {movie.totalSeasons != null &&
                      movie.totalEpisodes != null &&
                      " / "}
                    {movie.totalEpisodes != null && (
                      <>{movie.totalEpisodes} Episodes</>
                    )}
                  </span>
                </>
              )}
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              <span className="font-bold text-white">
                {formatRating(movie.rating)}
              </span>
              <span className="text-zinc-500 text-xs">IMDb</span>
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Play Now */}
            <button
              onClick={() => navigate(`/watch/${movie.id}`)}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "gap-2.5 font-bold transition-transform hover:scale-[1.04] active:scale-[0.97]",
              )}
            >
              <Play className="w-5 h-5 fill-white" />
              Play Now
            </button>

            {/* Favorite */}
            <button
              onClick={favorite.onToggle}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center border transition-all hover:scale-110 active:scale-90",
                favorite.active
                  ? "bg-orange-500/20 border-orange-500/60 text-orange-500"
                  : "glass border-white/20 text-zinc-400 hover:text-white",
              )}
              title={favorite.active ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                className={cn("w-5 h-5", favorite.active && "fill-orange-500")}
              />
            </button>

            {/* Share */}
            <div className="relative">
              <button
                onClick={handleShare}
                className="w-12 h-12 rounded-full glass border border-white/20 text-zinc-400 hover:text-white flex items-center justify-center transition-all hover:scale-110 active:scale-90"
                title="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
              {shareTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-white whitespace-nowrap border border-zinc-700">
                  Link copied!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dot indicators — auto-rotating hero backdrop */}
        {galleryImages.length > 1 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
            {galleryImages.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setActiveImageIndex(i)}
                aria-label={`Show image ${i + 1}`}
                className={cn(
                  "rounded-full transition-all duration-300 focus:outline-none cursor-pointer",
                  i === activeImageIndex
                    ? "w-6 h-2 bg-orange-500 shadow-md shadow-orange-500/50"
                    : "w-2 h-2 bg-white/30 hover:bg-white/60",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── CONTENT SECTION ── */}
      <div className="relative z-10 bg-background px-4 md:px-8 lg:px-12 pt-0 pb-8">
        <div className="space-y-10">
          {/* ── Episodes (series only) ── */}
          {eps && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4">Episodes</h2>
              <div className="flex flex-wrap items-center gap-2">
                {availableSeasons.length > 1 && (
                  <Select
                    icon={<Layers size={14} />}
                    value={String(activeSeason)}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    options={availableSeasons.map((s) => ({
                      id: String(s),
                      label: `S${s}`,
                    }))}
                  />
                )}
                {episodeList.map((ep) => (
                  <Tag
                    key={ep}
                    watched={watchedEpisodes.has(`${activeSeason}:${ep}`)}
                    onClick={() =>
                      navigate(`/watch/${movie.id}?s=${activeSeason}&e=${ep}`)
                    }
                  >
                    E{ep}
                  </Tag>
                ))}
              </div>
            </section>
          )}

          {/* ── About ── */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">About</h2>
            <p className="text-zinc-300 leading-relaxed text-base max-w-3xl">
              {movie.description}
            </p>
          </section>

          {/* ── Cast ── */}
          {movie.cast && movie.cast.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4">Cast</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-5">
                {movie.cast.map((member, i) => (
                  <div
                    key={member.id || `${member.name}-${i}`}
                    className="flex items-center gap-3 w-44"
                  >
                    {member.photo ? (
                      <img
                        src={member.photo}
                        alt={member.name}
                        loading="lazy"
                        className="w-12 h-12 rounded-full object-cover bg-zinc-800 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-400 flex-shrink-0">
                        {member.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {member.name}
                      </p>
                      {member.character && (
                        <p className="text-xs text-zinc-500 truncate">
                          {member.character}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── More Like This ── */}
          {similarMovies.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4">
                More Like This
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                {similarMovies.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    size="lg"
                    className="w-full"
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
