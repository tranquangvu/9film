import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { X, ListFilter } from "lucide-react";
import { genres, genreName } from "@/data/genres";
import { useTitleListing } from "@/hooks/use-title-listing";
import { cn } from "@/utils/cn";
import { Tag } from "@/components/ui/tag";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { BrowseContent } from "@/components/system/common/browse-content";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

type ContentType = "movie" | "series";

const TYPE_OPTIONS: { id: ContentType; label: string; icon: string }[] = [
  { id: "movie", label: "Movies", icon: "🎬" },
  { id: "series", label: "TV Series", icon: "📺" },
];

// Applied filters live entirely in the URL so a reload (or shared link)
// restores the exact same search. `q` = free-text, `type` = movie|series,
// `genre` = comma-separated genre ids.
function isContentType(v: string | null): v is ContentType {
  return v === "movie" || v === "series";
}

export default function BrowsePage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Free-text title search (e.g. arriving from the home search box: /browse?q=…).
  const searchTerm = (searchParams.get("q") ?? "").trim();
  const typeParam = searchParams.get("type");
  const contentType: ContentType | null = isContentType(typeParam)
    ? typeParam
    : null;
  const selectedGenres = useMemo(() => {
    const valid = new Set(genres.map((g) => g.id));
    return new Set(
      (searchParams.get("genre") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((id) => valid.has(id)),
    );
  }, [searchParams]);

  // Write applied filters back to the URL, omitting empty values.
  const applyFilters = useCallback(
    (type: ContentType | null, genreSet: Set<string>, term: string) => {
      const next: Record<string, string> = {};
      if (term) next.q = term;
      if (type) next.type = type;
      if (genreSet.size) next.genre = [...genreSet].join(",");
      setSearchParams(next);
    },
    [setSearchParams],
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftType, setDraftType] = useState<ContentType | null>(contentType);
  const [draftGenres, setDraftGenres] = useState<Set<string>>(selectedGenres);
  const [draftSearch, setDraftSearch] = useState(searchTerm);

  const activeCount =
    (searchTerm ? 1 : 0) + (contentType ? 1 : 0) + selectedGenres.size;

  const handleDrawerOpenChange = (open: boolean) => {
    if (open) {
      setDraftType(contentType);
      setDraftGenres(new Set(selectedGenres));
      setDraftSearch(searchTerm);
    }
    setDrawerOpen(open);
  };

  const toggleDraftType = (type: ContentType) => {
    setDraftType((prev) => (prev === type ? null : type));
  };

  const toggleDraftGenre = (id: string) => {
    setDraftGenres((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearDraft = () => {
    setDraftType(null);
    setDraftGenres(new Set());
    setDraftSearch("");
  };

  const handleSearch = () => {
    applyFilters(draftType, draftGenres, draftSearch.trim());
    setDrawerOpen(false);
  };

  const clearAll = useCallback(() => {
    setDraftType(null);
    setDraftGenres(new Set());
    setDraftSearch("");
    setSearchParams({});
  }, [setSearchParams]);

  const browseType =
    contentType === "movie"
      ? "movie"
      : contentType === "series"
        ? "tv"
        : undefined;
  const primaryGenre =
    selectedGenres.size === 1 ? genreName([...selectedGenres][0]) : undefined;

  // Type/genre always filter client-side on top of whichever source is active.
  const { searching, movies, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useTitleListing({
      searchTerm,
      type: browseType,
      genre: primaryGenre,
    });

  useEffect(() => {
    if (isError) {
      toast({
        title: "Failed to load content",
        description: "Could not load titles. Please try again.",
        variant: "destructive",
      });
    }
  }, [isError, toast]);

  const filtered = useMemo(() => {
    let result = movies;

    if (contentType) {
      result = result.filter((m) => m.type === contentType);
    }

    if (selectedGenres.size > 1) {
      const names = [...selectedGenres].map((id) =>
        genreName(id).toLowerCase(),
      );
      result = result.filter((m) =>
        m.genres.some((g) => names.includes(g.toLowerCase())),
      );
    }

    return result;
  }, [movies, contentType, selectedGenres]);

  const gridKey = `grid-${searchTerm}-${contentType ?? "all"}-${[...selectedGenres].join("-")}`;

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
                transition={{ duration: 0.3 }}
                className="text-3xl md:text-4xl font-bold text-white"
              >
                Browse
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-zinc-500 mt-1 text-sm"
              >
                Discover your next favorite film
              </motion.p>
            </div>

            {/* Filter drawer trigger */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
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

        {/* Content — memoized so drawer open/close doesn't reconcile the grid */}
        <BrowseContent
          isLoading={isLoading || isError}
          items={filtered}
          gridKey={gridKey}
          emptyIcon="🔍"
          emptyTitle="No titles found"
          emptyMessage={
            searching
              ? `No titles match “${searchTerm}”.`
              : "Try selecting different genres."
          }
          onClearAll={clearAll}
          hasMore={hasNextPage}
          onLoadMore={fetchNextPage}
          isLoadingMore={isFetchingNextPage}
        />

        {/* Filter drawer */}
        <DrawerContent>
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

          <div className="flex-1 overflow-y-auto px-5 pt-8 pb-5 space-y-6">
            {/* Title / IMDb id search */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                Search
              </h3>
              <Input
                type="text"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="Name or imdb (e.g. tt2575988)"
                className="px-4 py-3 rounded-xl text-sm bg-white/6 border border-white/10 focus:border-orange-500/50"
              />
            </div>

            {/* Type group */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                Type
              </h3>
              <div className="flex flex-wrap gap-3">
                {TYPE_OPTIONS.map((type) => (
                  <Tag
                    key={type.id}
                    active={draftType === type.id}
                    onClick={() => toggleDraftType(type.id)}
                  >
                    <span className="text-base leading-none">{type.icon}</span>
                    {type.label}
                  </Tag>
                ))}
              </div>
            </div>

            {/* Genre group */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                Genre
              </h3>
              <div className="flex flex-wrap gap-3">
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
              disabled={
                draftType === null &&
                draftGenres.size === 0 &&
                draftSearch.trim() === ""
              }
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
