import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { HeroBanner } from '@/components/system/title/hero-banner';
import { HorizontalCarousel } from '@/components/system/title/title-carousel';
import { CarouselSkeleton, HeroBannerSkeleton } from '@/components/system/title/skeletons';
import {
  useResumeTitles,
  usePopularTitles,
  usePopularMovieTitles,
  usePopularTVSeriesTitles,
  selectHeroAndTop10,
} from '@/hooks/use-home-titles';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

function QuickSearch() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/browse?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <section className="px-6 md:px-12">
      <div
        className="relative overflow-hidden rounded-2xl px-8 py-8 flex flex-col md:flex-row md:items-center gap-6"
        style={{
          background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(17,17,17,0.95) 60%)',
          border: '1px solid rgba(249,115,22,0.15)',
        }}
      >
        <div
          className="absolute -left-10 -top-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)' }}
        />
        <Search
          className="absolute top-1/2 -translate-y-1/2 left-0 w-32 h-32 text-orange-500/8 pointer-events-none select-none"
          aria-hidden
        />
        <div className="relative flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white tracking-tight">Find your next watch</h2>
          <p className="text-zinc-500 text-sm mt-1">Explore thousands of films, series, and hidden gems</p>
        </div>
        <form onSubmit={handleSubmit} className="relative flex items-center w-full md:w-96 flex-shrink-0">
          <div className="relative flex-1">
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. tt1375666, Inception"
              className="pl-4 pr-12 py-3 rounded-xl text-sm bg-white/6 border border-white/10 focus:border-orange-500/50"
            />
            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                buttonVariants({ variant: 'primary', size: 'icon-sm' }),
                'absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg shadow-none',
              )}
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </motion.button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { toast } = useToast();
  const popularQuery = usePopularTitles();
  const popularTitlesQuery = usePopularMovieTitles();
  const popularSeriesQuery = usePopularTVSeriesTitles();
  const resumeQuery = useResumeTitles();

  const hasError =
    popularQuery.isError ||
    popularTitlesQuery.isError ||
    popularSeriesQuery.isError ||
    resumeQuery.isError;

  useEffect(() => {
    if (hasError) {
      toast({
        title: 'Failed to load content',
        description: 'Could not load some titles. Please try again.',
        variant: 'destructive',
      });
    }
  }, [hasError, toast]);

  const popularTitles = popularTitlesQuery.data ?? [];
  const popularSeries = popularSeriesQuery.data ?? [];
  const resumeTitles = resumeQuery.data ?? [];

  // Hero + Top 10 are carved out of the popular feed, minus everything the
  // Popular rows already show, so the sections never fully duplicate.
  const { hero: heroTitles, top10: top10Titles } = useMemo(
    () =>
      selectHeroAndTop10({
        candidates: popularQuery.data ?? [],
        popularRows: [...(popularTitlesQuery.data ?? []), ...(popularSeriesQuery.data ?? [])],
      }),
    [popularQuery.data, popularTitlesQuery.data, popularSeriesQuery.data],
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {popularQuery.isLoading || popularQuery.isError ? <HeroBannerSkeleton /> : <HeroBanner titles={heroTitles} />}

      <div className="pt-8 pb-16 space-y-12 relative z-10">
        {resumeQuery.loading || resumeQuery.isError ? (
          <CarouselSkeleton cardType="backdrop" />
        ) : resumeTitles.length > 0 ? (
          <HorizontalCarousel title="Continue Watching" titles={resumeTitles} cardType="backdrop" />
        ) : null}

        {popularQuery.isLoading || popularQuery.isError ? (
          <CarouselSkeleton cardType="top10" />
        ) : top10Titles.length > 0 ? (
          <HorizontalCarousel title="Top 10 Today" titles={top10Titles} cardType="top10" />
        ) : null}

        {popularTitlesQuery.isLoading || popularTitlesQuery.isError ? (
          <CarouselSkeleton />
        ) : popularTitles.length > 0 ? (
          <HorizontalCarousel title="Popular Movies" titles={popularTitles} viewAllTo="/movies" />
        ) : null}

        {popularSeriesQuery.isLoading || popularSeriesQuery.isError ? (
          <CarouselSkeleton />
        ) : popularSeries.length > 0 ? (
          <HorizontalCarousel title="Popular TVSeries" titles={popularSeries} viewAllTo="/tvs" />
        ) : null}

        <QuickSearch />
      </div>
    </div>
  );
}
