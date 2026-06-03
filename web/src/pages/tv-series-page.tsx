import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ListFilter } from "lucide-react";
import { genres, genreName } from "@/data/genres";
import { MovieCard } from "@/components/system/movie/movie-card";
import { Empty } from "@/components/system/common/empty";
import { MovieGridSkeleton } from "@/components/system/movie/skeletons";
import { useBrowseTitleQuery } from "@/hooks/queries/use-browse-title-query";
import { cn } from "@/utils/cn";
import { toMovies } from "@/utils/title";
import { Tag } from "@/components/ui/tag";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

export default function TvSeriesPage() {
  // Applied filters — these drive the query and the visible grid.
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());

  // Drawer + draft filters — edited inside the drawer, committed on "Search".
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftGenres, setDraftGenres] = useState<Set<string>>(selectedGenres);

  const activeCount = selectedGenres.size;

  const primaryGenre =
    selectedGenres.size === 1 ? genreName([...selectedGenres][0]) : undefined;

  const browse = useBrowseTitleQuery({
    type: "tv",
    genre: primaryGenre,
    first: 50,
  });

  // Sync the drawer's draft with the applied filters whenever it opens.
  const handleDrawerOpenChange = (open: boolean) => {
    if (open) {
      setDraftGenres(new Set(selectedGenres));
    }
    setDrawerOpen(open);
  };

  const toggleDraftGenre = (id: string) => {
    setDraftGenres((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearDraft = () => setDraftGenres(new Set());

  // Commit the draft filters and close the drawer.
  const handleSearch = () => {
    setSelectedGenres(new Set(draftGenres));
    setDrawerOpen(false);
  };

  const clearAll = () => {
    setSelectedGenres(new Set());
    setDraftGenres(new Set());
  };

  const filtered = useMemo(() => {
    let result = toMovies(browse.data?.titles ?? []).filter(
      (m) => m.type === "series",
    );

    if (selectedGenres.size > 1) {
      const names = [...selectedGenres].map((id) =>
        genreName(id).toLowerCase(),
      );
      result = result.filter((m) =>
        m.genres.some((g) => names.includes(g.toLowerCase())),
      );
    }

    return result;
  }, [browse.data, selectedGenres]);

  return (
    <Drawer open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
      <div className="min-h-screen bg-background pb-16">
        {/* Page header */}
        <div className="pt-24 pb-6 px-4 md:px-8 lg:px-12">
          <div className="flex items-center justify-between gap-4">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-3xl md:text-4xl font-bold text-white"
              >
                TV Series
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-zinc-500 mt-1 text-sm"
              >
                Binge-worthy shows from around the world
              </motion.p>
            </div>

            {/* Filter drawer trigger */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="shrink-0"
            >
              <DrawerTrigger asChild>
                <button
                  aria-label="Open filters"
                  className={cn(
                    buttonVariants({ variant: "icon", size: "icon" }),
                    "relative shrink-0 border-0",
                  )}
                >
                  <ListFilter className="w-5 h-5" />
                  {activeCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-orange-500 text-white text-[11px] font-bold leading-none shadow-lg">
                      {activeCount}
                    </span>
                  )}
                </button>
              </DrawerTrigger>
            </motion.div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 md:px-8 lg:px-12 mt-6">
          <AnimatePresence mode="wait">
            {browse.isLoading ? (
              <MovieGridSkeleton />
            ) : filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Empty
                  icon="📺"
                  title="No series found"
                  message="Try selecting different genres."
                  actionLabel="Clear Filters"
                  onAction={clearAll}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`grid-${[...selectedGenres].join("-")}`}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8"
              >
                {filtered.map((series) => (
                  <motion.div key={series.id} variants={itemVariants}>
                    <MovieCard movie={series} size="lg" className="w-full" />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filter drawer */}
        <DrawerContent>
          {/* Header */}
          <DrawerHeader>
            <div className="flex items-center gap-2">
              <ListFilter size={18} className="text-orange-500" />
              <DrawerTitle>Filters</DrawerTitle>
            </div>
            <DrawerClose asChild>
              <button
                aria-label="Close filters"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 border-0 bg-transparent shadow-none",
                )}
              >
                <X size={18} />
              </button>
            </DrawerClose>
          </DrawerHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Genre group */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Genre
              </h3>
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => {
                  const active = draftGenres.has(g.id);
                  return (
                    <Tag
                      key={g.id}
                      active={false}
                      onClick={() => toggleDraftGenre(g.id)}
                      className={active ? "border-transparent" : undefined}
                      style={
                        active
                          ? {
                              background: `${g.color}22`,
                              borderColor: `${g.color}66`,
                              color: g.color,
                            }
                          : undefined
                      }
                    >
                      <span className="text-base leading-none">{g.icon}</span>
                      {g.name}
                    </Tag>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <DrawerFooter>
            <Button
              variant="primary"
              size="md"
              onClick={handleSearch}
              className="w-full"
            >
              Search
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={clearDraft}
              disabled={draftGenres.size === 0}
              className="w-full"
            >
              Clear
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </div>
    </Drawer>
  );
}
