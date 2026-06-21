import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play,
  Heart,
  HeartPlus,
  Share2,
  ArrowLeft,
  Star,
  Calendar,
  Clock,
  MapPin,
  Film,
  CirclePlay,
} from "lucide-react";
import { useTitleQuery } from "@/hooks/queries/use-title-query";
import { useSimilarQuery } from "@/hooks/queries/use-similar-query";
import { useStreamQuery } from "@/hooks/queries/use-stream-query";
import { toTitle, toTitles, embedParams } from "@/utils/title";
import { seasons, episodes, type EmbedParams } from "@/utils/stream";
import { cn } from "@/utils/cn";
import { formatDuration, formatRating, formatYear } from "@/utils/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TitleCard } from "@/components/system/title/title-card";
import { GenreBadge } from "@/components/system/title/genre-badge";
import { OrangeGradientDefs, ORANGE_GRADIENT_FILL } from "@/components/system/common/orange-gradient";
import { DetailPageSkeleton } from "@/components/system/title/skeletons";
import { useFavoriteButton } from "@/hooks/queries/use-favorites-query";
import {
  useWatchedEpisodes,
  useCurrentEpisode,
  useTitleProgress,
  progressPercent,
} from "@/hooks/queries/use-progress-query";

export default function TitleDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const mouseStartX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const wheelCooldown = useRef(false);
  const { toast } = useToast();

  const titleQuery = useTitleQuery(id);
  const similarQuery = useSimilarQuery(id);
  const title = titleQuery.data ? toTitle(titleQuery.data) : null;
  const similarTitles = toTitles(similarQuery.data ?? []);

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
    const urls = (title.images?.map((img) => img.url) ?? []).filter(
      (url): url is string => !!url,
    );
    return [...new Set(urls)];
  }, [titleQuery.data]);

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [shareTooltip, setShareTooltip] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // The image currently shown as the opaque base layer. The active image fades
  // in on top of it; once the fade finishes, it becomes the new base. Keeping a
  // fully-opaque layer underneath avoids the mid-crossfade darkening dip.
  const [baseImageIndex, setBaseImageIndex] = useState(0);

  const favorite = useFavoriteButton(id, title?.type ?? "movie", title?.isFavorite);
  const watchedEpisodes = useWatchedEpisodes(id);
  const currentEpisode = useCurrentEpisode(id);
  const titleProgress = useTitleProgress(id);

  const goToNextImage = useCallback(() => {
    setActiveImageIndex((i) => (i + 1) % galleryImages.length);
  }, [galleryImages.length]);

  const goToPrevImage = useCallback(() => {
    setActiveImageIndex(
      (i) => (i - 1 + galleryImages.length) % galleryImages.length,
    );
  }, [galleryImages.length]);

  useEffect(() => {
    if (galleryImages.length < 2) return;
    const timer = setInterval(goToNextImage, 6000);
    return () => clearInterval(timer);
  }, [galleryImages.length, goToNextImage]);

  // Swipe / horizontal-wheel navigation across the hero gallery, mirroring the
  // home hero banner. Non-passive touch/wheel listeners so we can preventDefault.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || galleryImages.length < 2) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dx > dy && dx > 10) e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(delta) > 50) { if (delta > 0) goToNextImage(); else goToPrevImage(); }
      touchStartX.current = null;
      touchStartY.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (Math.abs(e.deltaX) < 30) return;
      e.preventDefault(); // blocks browser back/forward navigation
      if (wheelCooldown.current) return;
      wheelCooldown.current = true;
      if (e.deltaX > 0) goToNextImage(); else goToPrevImage();
      setTimeout(() => { wheelCooldown.current = false; }, 800);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [galleryImages.length, goToNextImage, goToPrevImage]);

  const handleHeroMouseDown = (e: React.MouseEvent) => {
    mouseStartX.current = e.clientX;
    isDragging.current = false;
  };

  const handleHeroMouseMove = (e: React.MouseEvent) => {
    if (mouseStartX.current === null) return;
    if (Math.abs(e.clientX - mouseStartX.current) > 5) isDragging.current = true;
  };

  const handleHeroMouseUp = (e: React.MouseEvent) => {
    if (mouseStartX.current === null) return;
    const delta = mouseStartX.current - e.clientX;
    if (Math.abs(delta) > 60) { if (delta > 0) goToNextImage(); else goToPrevImage(); }
    mouseStartX.current = null;
  };

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

  if (!title) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="text-6xl">🎬</div>
        <h1 className="text-3xl font-bold text-white">Title not found</h1>
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

  // Title watch progress (series surface this per-episode in the Episodes grid).
  const watchPercent = titleProgress ? progressPercent(titleProgress) : 0;
  const isWatchingTitle = title.type === "movie" && watchPercent > 0;
  const remainingMinutes = titleProgress
    ? Math.max(
        0,
        Math.round(
          (titleProgress.durationSeconds - titleProgress.positionSeconds) / 60,
        ),
      )
    : 0;

  // Whether the user has any progress to resume (titles: a saved position;
  // series: a most-recently-played episode). Drives the Play/Resume label.
  const isResumable =
    title.type === "movie" ? isWatchingTitle : currentEpisode != null;

  const handlePlay = () => {
    if (title.type !== "movie" && currentEpisode) {
      navigate(`/watch/${title.id}?s=${currentEpisode.season}&e=${currentEpisode.episode}`);
    } else {
      navigate(`/watch/${title.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <div
        ref={heroRef}
        className="relative w-full h-screen overflow-hidden"
        onMouseDown={handleHeroMouseDown}
        onMouseMove={handleHeroMouseMove}
        onMouseUp={handleHeroMouseUp}
        onMouseLeave={handleHeroMouseUp}
        style={{ userSelect: "none", overscrollBehaviorX: "none" }}
      >
        {/* Backdrop — crossfades through gallery images. The base layer always
            stays fully opaque while the incoming image fades in on top, so the
            composite never dips to the (dark) background mid-transition. */}
        <div className="absolute inset-0 bg-black">
          <img
            key={`base-${galleryImages[baseImageIndex] ?? title.backdrop}`}
            src={galleryImages[baseImageIndex] ?? title.backdrop}
            alt={title.title}
            draggable={false}
            className="absolute inset-0 object-cover w-full h-full"
          />
          {activeImageIndex !== baseImageIndex && (
            <motion.img
              key={`top-${galleryImages[activeImageIndex] ?? title.backdrop}`}
              src={galleryImages[activeImageIndex] ?? title.backdrop}
              alt={title.title}
              draggable={false}
              className="absolute inset-0 object-cover w-full h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              onAnimationComplete={() => setBaseImageIndex(activeImageIndex)}
            />
          )}
        </div>

        <div className="absolute inset-0 gradient-overlay" />
        <div className="absolute inset-0 gradient-overlay-right" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-black/30" />

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

        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-28 md:px-8 lg:px-12 max-w-4xl">
          <div className="flex flex-wrap gap-2 mb-2">
            {title.genres.map((genre) => (
              <GenreBadge key={genre} genre={genre} />
            ))}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-3 drop-shadow-2xl">
            {title.title}
          </h1>

          {title.tagline && (
            <p className="text-lg text-zinc-300 italic mb-5 drop-shadow-lg">
              "{title.tagline}"
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-7 text-sm text-zinc-300">
            <span className="flex items-center gap-1.5 font-semibold text-white">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              {formatYear(title.year)}
            </span>
            {title.duration > 0 && (
              <>
                <span className="w-px h-4 bg-zinc-700" />
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  {formatDuration(title.duration)}
                </span>
              </>
            )}
            <span className="w-px h-4 bg-zinc-700" />
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              {title.country}
            </span>
            {title.type === "series" &&
              (title.totalSeasons || title.totalEpisodes) && (
                <>
                  <span className="w-px h-4 bg-zinc-700" />
                  <span className="flex items-center gap-1">
                    <Film className="w-3.5 h-3.5 text-zinc-500" />
                    {title.totalSeasons != null && (
                      <>
                        {title.totalSeasons}{" "}
                        {title.totalSeasons === 1 ? "Season" : "Seasons"}
                      </>
                    )}
                    {title.totalSeasons != null &&
                      title.totalEpisodes != null &&
                      " / "}
                    {title.totalEpisodes != null && (
                      <>{title.totalEpisodes} Episodes</>
                    )}
                  </span>
                </>
              )}
            <span className="w-px h-4 bg-zinc-700" />
            <span className="flex items-center gap-1.5">
              <OrangeGradientDefs />
              <Star className="w-3.5 h-3.5" style={{ fill: ORANGE_GRADIENT_FILL, stroke: ORANGE_GRADIENT_FILL }} />
              <span className="font-bold text-white">
                {formatRating(title.rating)}
              </span>
              <span className="text-zinc-500 text-xs">IMDb</span>
            </span>
            {isWatchingTitle && (
              <>
                <span className="w-px h-4 bg-zinc-700" />
                <span className="flex items-center gap-1 font-medium text-orange-400">
                  <Play className="w-3.5 h-3.5" />
                  {watchPercent}% watched
                  {remainingMinutes > 0 && (
                    <span className="text-zinc-400 font-normal">
                      · {formatDuration(remainingMinutes)} left
                    </span>
                  )}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handlePlay}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "gap-2.5 font-bold transition-transform hover:scale-[1.04] active:scale-[0.97]",
              )}
            >
              <Play className="w-5 h-5 fill-white" />
              {isResumable ? "Resume" : "Play Now"}
            </button>

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
              <OrangeGradientDefs />
              {favorite.active ? (
                <Heart
                  className="w-5 h-5"
                  style={{ fill: ORANGE_GRADIENT_FILL, stroke: ORANGE_GRADIENT_FILL }}
                />
              ) : (
                <HeartPlus className="w-5 h-5" />
              )}
            </button>

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

      <div className="relative z-10 bg-background px-4 md:px-8 lg:px-12 pt-0 pb-8">
        <div className="space-y-10">
          {eps && (
            <section className="max-w-3xl xl:max-w-[65%]">
              <h2 className="text-xl font-bold text-white mb-4">Episodes</h2>
              <div className="flex flex-wrap items-center gap-2">
                {availableSeasons.length > 1 && (
                  <SelectField
                    icon={<Film size={14} />}
                    value={String(activeSeason)}
                    onValueChange={(v) => setSelectedSeason(Number(v))}
                    options={availableSeasons.map((s) => ({
                      id: String(s),
                      label: `S${String(s).padStart(2, "0")}`,
                    }))}
                  />
                )}
                {episodeList.map((ep) => {
                  const isPlaying =
                    currentEpisode?.season === activeSeason &&
                    currentEpisode?.episode === ep;
                  const isWatched = watchedEpisodes.has(
                    `${activeSeason}:${ep}`,
                  );
                  return (
                    <Badge variant="tag"
                      key={ep}
                      onClick={() =>
                        navigate(`/watch/${title.id}?s=${activeSeason}&e=${ep}`)
                      }
                    >
                      {isPlaying ? (
                        <CirclePlay className="w-3.5 h-3.5 text-orange-400" />
                      ) : isWatched ? (
                        <span className="block w-1.5 h-1.5 rounded-full bg-orange-400" />
                      ) : null}
                      E{String(ep).padStart(2, "0")}
                    </Badge>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl font-bold text-white mb-4">About</h2>
            <p className="text-zinc-300 leading-relaxed text-base max-w-3xl xl:max-w-[65%]">
              {title.description}
            </p>
          </section>

          {title.cast && title.cast.length > 0 && (
            <section className="max-w-3xl xl:max-w-[65%]">
              <h2 className="text-xl font-bold text-white mb-4">Cast</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-5">
                {title.cast.map((member, i) => (
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

          {similarTitles.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4">
                More Like This
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                {similarTitles.map((title) => (
                  <TitleCard
                    key={title.id}
                    title={title}
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
