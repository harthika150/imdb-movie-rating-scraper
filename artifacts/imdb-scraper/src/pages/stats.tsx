import { useGetMovieStats, useGetScrapeHistory, getGetScrapeHistoryQueryKey } from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, RadialBarChart, RadialBar, Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Film, Star, Calendar, Hash, Clock, Eye, Bookmark, Trophy, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const GENRE_COLORS = [
  "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6",
  "#a855f7", "#6366f1", "#22c55e", "#f43f5e", "#0ea5e9",
];

export default function Stats() {
  const { data: stats, isLoading } = useGetMovieStats();
  const { data: scrapeHistory } = useGetScrapeHistory({
    query: { queryKey: getGetScrapeHistoryQueryKey(), staleTime: 30000 },
  });

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary mb-2">Statistics</h1>
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16 mb-1" /><Skeleton className="h-3 w-32" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="border-border/50">
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (stats.totalMovies === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Film className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-2xl font-bold text-foreground">No Data Available</h2>
        <p className="text-muted-foreground mt-2 max-w-md">Go to the dashboard and trigger a scrape to populate statistics.</p>
      </div>
    );
  }

  const ratingData = [...stats.ratingDistribution].reverse();
  const decadeData = stats.decadeDistribution;
  const genreData = stats.genreDistribution.slice(0, 12);
  const directorData = stats.topDirectors.slice(0, 10);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Statistics</h1>
        <p className="text-muted-foreground mt-1">Analytical breakdown of the Top 250 movies.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Movies" value={stats.totalMovies.toString()} subtitle="In the database" icon={<Hash className="h-4 w-4 text-primary" />} />
        <StatCard title="Avg Rating" value={stats.averageRating.toFixed(2)} subtitle="Across all movies" icon={<Star className="h-4 w-4 text-primary" />} />
        <StatCard title="Era Span" value={`${stats.oldestYear}–${stats.newestYear}`} subtitle="Year range" icon={<Calendar className="h-4 w-4 text-primary" />} />
        <StatCard
          title="Avg Runtime"
          value={stats.averageRuntime ? `${stats.averageRuntime}m` : "N/A"}
          subtitle="Per film"
          icon={<Clock className="h-4 w-4 text-primary" />}
        />
        <StatCard title="Rating High" value={stats.highestRating.toFixed(1)} subtitle="Best rated" icon={<Trophy className="h-4 w-4 text-primary" />} />
        <StatCard title="Rating Low" value={stats.lowestRating.toFixed(1)} subtitle="Lowest rated" icon={<Film className="h-4 w-4 text-primary" />} />
        <StatCard title="Watched" value={(stats.watchedCount ?? 0).toString()} subtitle="Films marked watched" icon={<Eye className="h-4 w-4 text-green-500" />} />
        <StatCard title="Watchlist" value={(stats.watchlistCount ?? 0).toString()} subtitle="Films saved" icon={<Bookmark className="h-4 w-4 text-primary" />} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-lg bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Rating Distribution</CardTitle>
            <CardDescription>Films within each rating bracket</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} animationDuration={1200} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-lg bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Release Decades</CardTitle>
            <CardDescription>Number of Top 250 films by decade</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={decadeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="decade" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorCount)" animationDuration={1200} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Genre Distribution */}
        <Card className="border-border/50 shadow-lg bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Genre Distribution</CardTitle>
            <CardDescription>Top 12 genres across all movies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={genreData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="genre" type="category" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={70} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} animationDuration={1200}>
                    {genreData.map((_, index) => (
                      <Cell key={index} fill={GENRE_COLORS[index % GENRE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Directors */}
        <Card className="border-border/50 shadow-lg bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Top Directors</CardTitle>
            <CardDescription>Directors with 2+ films in the Top 250</CardDescription>
          </CardHeader>
          <CardContent>
            {directorData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">No director data available</div>
            ) : (
              <div className="space-y-3 mt-2">
                {directorData.map((d, i) => (
                  <div key={d.director} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4 text-right font-mono">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground truncate">{d.director}</span>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                            {d.count} films
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-primary text-primary" />{d.avgRating.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(d.count / (directorData[0]?.count || 1)) * 100}%`,
                            backgroundColor: GENRE_COLORS[i % GENRE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scrape History */}
      <Card className="border-border/50 shadow-lg bg-card/60 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Scrape History</CardTitle>
          <CardDescription>Last 50 scrape runs</CardDescription>
        </CardHeader>
        <CardContent>
          {!scrapeHistory || scrapeHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No scrape runs recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">#</th>
                    <th className="text-left py-2 pr-4 font-medium">Started</th>
                    <th className="text-left py-2 pr-4 font-medium">Duration</th>
                    <th className="text-left py-2 pr-4 font-medium">Movies</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapeHistory.map((run, idx) => {
                    const started = new Date(run.startedAt);
                    const succeeded = run.success === "true" || run.success === true as unknown as string;
                    return (
                      <tr key={run.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="py-2.5 pr-4">
                          <div className="font-medium">{format(started, "MMM d, yyyy")}</div>
                          <div className="text-xs text-muted-foreground">{formatDistanceToNow(started, { addSuffix: true })}</div>
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground">
                          {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">{run.totalScraped}</td>
                        <td className="py-2.5">
                          {succeeded ? (
                            <span className="inline-flex items-center gap-1 text-green-500">
                              <CheckCircle className="h-3.5 w-3.5" /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <XCircle className="h-3.5 w-3.5" /> Failed
                              {run.error && <span className="text-xs text-muted-foreground ml-1 truncate max-w-[200px]">({run.error})</span>}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }: { title: string; value: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <Card className="border-border/50 bg-card/50 shadow-sm transition-all hover:bg-card hover:shadow-md hover:border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 bg-primary/10 rounded-md">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
