import { useEffect, useState, useMemo } from "react";
import {
  useListMovies,
  useGetScrapeStatus,
  useTriggerScrape,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useMarkWatched,
  useUnmarkWatched,
  getListMoviesQueryKey,
  getGetScrapeStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Download, RefreshCw, Search, ArrowUpDown, Star, ExternalLink,
  Loader2, Film, Bookmark, BookmarkCheck, Eye, EyeOff, X, Clock, User, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { ListMoviesParams, Movie } from "@workspace/api-client-react";

const ALL_GENRES = [
  "Action", "Adventure", "Animation", "Biography", "Comedy", "Crime",
  "Documentary", "Drama", "Family", "Fantasy", "Film-Noir", "History",
  "Horror", "Music", "Musical", "Mystery", "Romance", "Sci-Fi",
  "Sport", "Thriller", "War", "Western",
];

type ViewMode = "all" | "watchlist" | "watched";

export default function Home() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [params, setParams] = useState<ListMoviesParams>({ sortBy: "rank", sortOrder: "asc" });
  const [searchInput, setSearchInput] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [isPolling, setIsPolling] = useState(false);

  const listParams = useMemo(() => ({
    ...params,
    watchlistOnly: viewMode === "watchlist" ? true : undefined,
    watchedOnly: viewMode === "watched" ? true : undefined,
  }), [params, viewMode]);

  const { data: movies, isLoading: isMoviesLoading } = useListMovies(listParams);
  const { data: scrapeStatus, isLoading: isStatusLoading } = useGetScrapeStatus({
    query: { queryKey: getGetScrapeStatusQueryKey(), refetchInterval: isPolling ? 2000 : false },
  });

  const triggerScrape = useTriggerScrape();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const markWatched = useMarkWatched();
  const unmarkWatched = useUnmarkWatched();

  const invalidateMovies = () => {
    queryClient.invalidateQueries({ queryKey: getListMoviesQueryKey() });
  };

  useEffect(() => {
    if (scrapeStatus?.isScrapingNow) {
      setIsPolling(true);
    } else if (isPolling) {
      setIsPolling(false);
      invalidateMovies();
      toast({ title: "Scrape Complete", description: "Successfully updated IMDb Top 250 movies." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrapeStatus?.isScrapingNow, isPolling]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setParams((p: ListMoviesParams) => ({ ...p, search: searchInput || undefined }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleScrape = () => {
    triggerScrape.mutate(undefined, {
      onSuccess: () => {
        setIsPolling(true);
        queryClient.invalidateQueries({ queryKey: getGetScrapeStatusQueryKey() });
        toast({ title: "Scrape Started", description: "Fetching latest movies from IMDb..." });
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Scrape Failed", description: error?.message || "Could not trigger scrape." });
      },
    });
  };

  const handleExportCSV = () => {
    if (!movies?.length) return;
    const headers = ["Rank", "Title", "Year", "Rating", "Votes", "Director", "Genres", "Runtime", "IMDb ID"];
    const csvContent = [
      headers.join(","),
      ...movies.map((m) => [
        m.rank, `"${m.title.replace(/"/g, '""')}"`, m.year, m.rating,
        `"${m.votes || ""}"`, `"${m.director || ""}"`,
        `"${(m.genres || []).join("; ")}"`, m.runtime || "", m.imdbId,
      ].join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `imdb_top_250_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSort = (field: "rank" | "title" | "year" | "rating" | "runtime") => {
    setParams((p) => ({
      ...p,
      sortBy: field,
      sortOrder: p.sortBy === field && p.sortOrder === "asc" ? "desc" : "asc",
    }));
  };

  const handleWatchlist = (movie: Movie, e: React.MouseEvent) => {
    e.stopPropagation();
    if (movie.inWatchlist) {
      removeFromWatchlist.mutate({ imdbId: movie.imdbId }, { onSuccess: invalidateMovies });
    } else {
      addToWatchlist.mutate({ imdbId: movie.imdbId }, { onSuccess: invalidateMovies });
    }
  };

  const handleWatched = (movie: Movie, e: React.MouseEvent) => {
    e.stopPropagation();
    if (movie.watched) {
      unmarkWatched.mutate({ imdbId: movie.imdbId }, { onSuccess: invalidateMovies });
    } else {
      markWatched.mutate({ imdbId: movie.imdbId }, { onSuccess: invalidateMovies });
    }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <ArrowUpDown className={`w-3 h-3 ml-1 ${params.sortBy === field ? "text-primary" : "opacity-40"}`} />
  );

  const isScraping = scrapeStatus?.isScrapingNow || triggerScrape.isPending;
  const hasMovies = movies && movies.length > 0;
  const hasFilters = !!searchInput || !!params.minRating || !!params.minYear || !!params.genre;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">IMDb Top 250</h1>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button variant="outline" onClick={handleExportCSV} disabled={!hasMovies}
            className="border-primary/20 hover:border-primary/50">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={handleScrape} disabled={isScraping}
            className="bg-primary text-primary-foreground hover:bg-primary/90">
            {isScraping ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scraping...</>
              : <><RefreshCw className="w-4 h-4 mr-2" />Scrape Now</>}
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList className="bg-muted/30 border border-border/50">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            All Movies
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Bookmark className="w-3.5 h-3.5 mr-1.5" /> Watchlist
          </TabsTrigger>
          <TabsTrigger value="watched" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Eye className="w-3.5 h-3.5 mr-1.5" /> Watched
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border/50 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title or director..."
              className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary/50"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <Select value={params.genre || "any"}
            onValueChange={(v) => setParams((p: ListMoviesParams) => ({ ...p, genre: v === "any" ? undefined : v }))}>
            <SelectTrigger className="w-[150px] bg-background/50 border-border/50">
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="any">Any Genre</SelectItem>
              {ALL_GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={params.minRating?.toString() || "any"}
            onValueChange={(v) => setParams((p: ListMoviesParams) => ({ ...p, minRating: v === "any" ? undefined : Number(v) }))}>
            <SelectTrigger className="w-[130px] bg-background/50 border-border/50">
              <SelectValue placeholder="Min Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Rating</SelectItem>
              <SelectItem value="9.0">9.0+</SelectItem>
              <SelectItem value="8.5">8.5+</SelectItem>
              <SelectItem value="8.2">8.2+</SelectItem>
              <SelectItem value="8.0">8.0+</SelectItem>
            </SelectContent>
          </Select>

          <Select value={params.minYear?.toString() || "any"}
            onValueChange={(v) => setParams((p: ListMoviesParams) => ({ ...p, minYear: v === "any" ? undefined : Number(v), maxYear: v === "any" ? undefined : Number(v) + 9 }))}>
            <SelectTrigger className="w-[130px] bg-background/50 border-border/50">
              <SelectValue placeholder="Decade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Decade</SelectItem>
              <SelectItem value="2020">2020s</SelectItem>
              <SelectItem value="2010">2010s</SelectItem>
              <SelectItem value="2000">2000s</SelectItem>
              <SelectItem value="1990">1990s</SelectItem>
              <SelectItem value="1980">1980s</SelectItem>
              <SelectItem value="1970">1970s</SelectItem>
              <SelectItem value="1960">1960s</SelectItem>
              <SelectItem value="1950">1950s</SelectItem>
              <SelectItem value="1920">Pre-1960</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"
              onClick={() => { setSearchInput(""); setParams({ sortBy: "rank", sortOrder: "asc" }); }}>
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          )}

          <div className="ml-auto text-sm text-muted-foreground self-center">
            {movies ? `${movies.length} movies` : ""}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto relative min-h-[400px]">
          {!hasMovies && !isMoviesLoading && !hasFilters && viewMode === "all" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <Film className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No Data Available</h3>
              <p className="text-muted-foreground max-w-sm mt-2 mb-6">Click "Scrape Now" to fetch the latest top movies.</p>
              <Button onClick={handleScrape} className="bg-primary text-primary-foreground">
                <RefreshCw className="w-4 h-4 mr-2" /> Scrape Now
              </Button>
            </div>
          ) : !hasMovies && !isMoviesLoading && viewMode !== "all" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              {viewMode === "watchlist" ? <Bookmark className="h-12 w-12 text-muted-foreground/30 mb-3" />
                : <Eye className="h-12 w-12 text-muted-foreground/30 mb-3" />}
              <h3 className="text-lg font-medium">
                {viewMode === "watchlist" ? "Your watchlist is empty" : "No watched movies yet"}
              </h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                {viewMode === "watchlist"
                  ? "Bookmark movies from the main list to add them here."
                  : "Mark movies as watched to track your progress."}
              </p>
            </div>
          ) : null}

          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="w-[70px]">
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("rank")} className="-ml-3 h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Rank <SortIcon field="rank" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("title")} className="-ml-3 h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Title <SortIcon field="title" />
                  </Button>
                </TableHead>
                <TableHead className="hidden md:table-cell w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Director</TableHead>
                <TableHead className="hidden sm:table-cell w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Genres</TableHead>
                <TableHead className="w-[80px] text-right">
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("year")} className="ml-auto -mr-3 h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Year <SortIcon field="year" />
                  </Button>
                </TableHead>
                <TableHead className="w-[100px] text-right">
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("rating")} className="ml-auto -mr-3 h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Rating <SortIcon field="rating" />
                  </Button>
                </TableHead>
                <TableHead className="hidden lg:table-cell w-[80px] text-right">
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("runtime")} className="ml-auto -mr-3 h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" /><SortIcon field="runtime" />
                  </Button>
                </TableHead>
                <TableHead className="w-[110px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isMoviesLoading && !movies ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="border-border/40">
                    {[70, 200, 120, 100, 60, 80, 60, 80].map((w, j) => (
                      <TableCell key={j}><Skeleton className={`h-5 w-${Math.round(w / 8)}`} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : movies?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    No movies match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                movies?.map((movie) => (
                  <TableRow
                    key={movie.imdbId}
                    className="group hover:bg-primary/5 border-border/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedMovie(movie)}
                  >
                    <TableCell className="font-mono text-muted-foreground text-sm">{movie.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {movie.title}
                        </span>
                        {movie.watched && <Eye className="w-3 h-3 text-green-500 flex-shrink-0" />}
                        {movie.inWatchlist && !movie.watched && <Bookmark className="w-3 h-3 text-primary flex-shrink-0" />}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm line-clamp-1">
                      {movie.director}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {movie.genres?.slice(0, 2).map((g) => (
                          <Badge key={g} variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                            {g}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">{movie.year}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 font-mono text-primary text-sm">
                        <Star className="w-3 h-3 fill-primary" />
                        {movie.rating.toFixed(1)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-muted-foreground text-sm">
                      {movie.runtime ? `${movie.runtime}m` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/20"
                          title={movie.watched ? "Unmark watched" : "Mark as watched"}
                          onClick={(e) => handleWatched(movie, e)}>
                          {movie.watched
                            ? <EyeOff className="w-3.5 h-3.5 text-green-500" />
                            : <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-green-500" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/20"
                          title={movie.inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                          onClick={(e) => handleWatchlist(movie, e)}>
                          {movie.inWatchlist
                            ? <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
                            : <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/20"
                          title="View details" onClick={(e) => { e.stopPropagation(); setSelectedMovie(movie); }}>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Movie Detail Sheet */}
      <Sheet open={!!selectedMovie} onOpenChange={(o) => !o && setSelectedMovie(null)}>
        <SheetContent className="w-full sm:max-w-lg bg-card border-border/60 overflow-y-auto">
          {selectedMovie && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-lg p-3 flex-shrink-0">
                    <Film className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-xl font-bold leading-tight text-foreground">
                      {selectedMovie.title}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span>{selectedMovie.year}</span>
                      {selectedMovie.runtime && (
                        <><span>·</span><span>{selectedMovie.runtime} min</span></>
                      )}
                      <span>·</span>
                      <span>#{selectedMovie.rank}</span>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Rating */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex flex-col items-center bg-primary/10 rounded-xl px-5 py-3 border border-primary/20">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-5 h-5 fill-primary text-primary" />
                    <span className="text-2xl font-bold text-primary font-mono">{selectedMovie.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-0.5">IMDb Rating</span>
                </div>
                {selectedMovie.votes && (
                  <div className="text-sm text-muted-foreground">
                    <div className="font-mono text-foreground">{selectedMovie.votes}</div>
                    <div className="text-xs">votes</div>
                  </div>
                )}
              </div>

              {/* Director */}
              {selectedMovie.director && (
                <div className="flex items-center gap-2 mb-4 text-sm">
                  <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Director:</span>
                  <span className="font-medium text-foreground">{selectedMovie.director}</span>
                </div>
              )}

              {/* Genres */}
              {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {selectedMovie.genres.map((g: string) => (
                    <Badge key={g} className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/25 cursor-pointer"
                      onClick={() => { setSelectedMovie(null); setParams((p: ListMoviesParams) => ({ ...p, genre: g })); }}>
                      {g}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Plot */}
              {selectedMovie.plot && (
                <div className="mb-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Synopsis</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">{selectedMovie.plot}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                <div className="flex gap-3">
                  <Button
                    variant={selectedMovie.watched ? "default" : "outline"}
                    className={selectedMovie.watched
                      ? "flex-1 bg-green-600 hover:bg-green-700 text-white border-0"
                      : "flex-1 border-border/60"}
                    onClick={(e) => { handleWatched(selectedMovie, e); setSelectedMovie((m: Movie | null) => m ? { ...m, watched: !m.watched } : null); }}>
                    {selectedMovie.watched ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                    {selectedMovie.watched ? "Unmark Watched" : "Mark Watched"}
                  </Button>
                  <Button
                    variant={selectedMovie.inWatchlist ? "default" : "outline"}
                    className={selectedMovie.inWatchlist
                      ? "flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "flex-1 border-border/60"}
                    onClick={(e) => { handleWatchlist(selectedMovie, e); setSelectedMovie((m: Movie | null) => m ? { ...m, inWatchlist: !m.inWatchlist } : null); }}>
                    {selectedMovie.inWatchlist ? <BookmarkCheck className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}
                    {selectedMovie.inWatchlist ? "In Watchlist" : "Add to Watchlist"}
                  </Button>
                </div>
                <a
                  href={`https://www.imdb.com/title/${selectedMovie.imdbId}/`}
                  target="_blank" rel="noreferrer noopener"
                  className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-2">
                  <ExternalLink className="w-4 h-4" />
                  View on IMDb
                </a>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
