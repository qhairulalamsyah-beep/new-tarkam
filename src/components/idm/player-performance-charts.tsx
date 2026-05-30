'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area, AreaChart, Bar, BarChart, Line, LineChart,
  XAxis, YAxis, CartesianGrid, ComposedChart,
} from 'recharts';
import { TrendingUp, Trophy, Crown, BarChart3, Medal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getDivisionTheme } from '@/hooks/use-division-theme';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';

// ── Types ──
interface PerformanceData {
  player: {
    id: string;
    gamertag: string;
    division: string;
  };
  weeklyPoints: Array<{ week: number; points: number; cumulativePoints: number }>;
  winLossPerWeek: Array<{ week: number; wins: number; losses: number }>;
  mvpPerWeek: Array<{ week: number; mvpCount: number }>;
  rankProgress: Array<{ week: number; rank: number }>;
  totalWeeks: number;
}

type TabKey = 'points' | 'winrate' | 'mvp' | 'rank';

interface PlayerPerformanceChartsProps {
  playerId: string;
  playerDivision: string;
}

// ── Skeleton chart placeholder ──
function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="w-full animate-pulse" style={{ height }}>
      <div className="flex items-end gap-2 h-full pt-8 pb-2 px-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-muted/20 rounded-t-md"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Tab Button ──
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  division,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  division: string;
}) {
  const dt = getDivisionTheme(division as 'male' | 'female');
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
        active
          ? `${dt.bgSubtle} ${dt.border} border ${dt.text} shadow-sm`
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/10'
      }`}
      role="tab"
      aria-selected={active}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ── Main Component ──
export function PlayerPerformanceCharts({ playerId, playerDivision }: PlayerPerformanceChartsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('points');
  const dt = getDivisionTheme(playerDivision as 'male' | 'female');
  const isMale = playerDivision === 'male';

  // Division-themed colors
  const primaryColor = isMale ? '#57B5FF' : '#FF5C9A';
  const primaryColorLight = isMale ? '#93CBFF' : '#FF8DBF';
  const secondaryColor = isMale ? '#2E9FFF' : '#FF2D78';

  // Fetch performance data
  const { data: performanceData, isLoading, isError } = useQuery({
    queryKey: ['player-performance', playerId, playerDivision],
    queryFn: async () => {
      const res = await fetch(`/api/players/${playerId}/performance?division=${playerDivision}`);
      if (!res.ok) throw new Error('Failed to fetch performance data');
      return res.json() as Promise<PerformanceData>;
    },
    enabled: !!playerId,
    staleTime: 60_000,
    gcTime: 60_000,
  });

  // Prepare chart data by merging all weekly arrays
  const chartData = useMemo(() => {
    if (!performanceData) return [];

    const weekSet = new Set<number>();
    performanceData.weeklyPoints.forEach(w => weekSet.add(w.week));
    performanceData.winLossPerWeek.forEach(w => weekSet.add(w.week));
    performanceData.mvpPerWeek.forEach(w => weekSet.add(w.week));
    performanceData.rankProgress.forEach(w => weekSet.add(w.week));

    const pointsMap = new Map(performanceData.weeklyPoints.map(w => [w.week, w]));
    const winLossMap = new Map(performanceData.winLossPerWeek.map(w => [w.week, w]));
    const mvpMap = new Map(performanceData.mvpPerWeek.map(w => [w.week, w]));
    const rankMap = new Map(performanceData.rankProgress.map(w => [w.week, w]));

    return Array.from(weekSet).sort((a, b) => a - b).map(week => ({
      week,
      weekLabel: `W${week}`,
      points: pointsMap.get(week)?.points ?? 0,
      cumulativePoints: pointsMap.get(week)?.cumulativePoints ?? 0,
      wins: winLossMap.get(week)?.wins ?? 0,
      losses: winLossMap.get(week)?.losses ?? 0,
      winRate: (() => {
        const wl = winLossMap.get(week);
        if (!wl || (wl.wins + wl.losses) === 0) return 0;
        return Math.round((wl.wins / (wl.wins + wl.losses)) * 100);
      })(),
      mvpCount: mvpMap.get(week)?.mvpCount ?? 0,
      rank: rankMap.get(week)?.rank ?? null,
    }));
  }, [performanceData]);

  const hasData = chartData.length > 0;

  // ── Chart configs ──
  const pointsChartConfig: ChartConfig = {
    cumulativePoints: { label: 'Total Poin', color: primaryColor },
    points: { label: 'Poin/Minggu', color: primaryColorLight },
  };

  const winRateChartConfig: ChartConfig = {
    wins: { label: 'Menang', color: '#22C55E' },
    losses: { label: 'Kalah', color: '#EF4444' },
    winRate: { label: 'Win Rate %', color: primaryColor },
  };

  const mvpChartConfig: ChartConfig = {
    mvpCount: { label: 'MVP', color: '#EAB308' },
  };

  const rankChartConfig: ChartConfig = {
    rank: { label: 'Peringkat', color: primaryColor },
  };

  const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'points', label: 'Poin', icon: TrendingUp },
    { key: 'winrate', label: 'Win Rate', icon: BarChart3 },
    { key: 'mvp', label: 'MVP', icon: Crown },
    { key: 'rank', label: 'Rank', icon: Medal },
  ];

  return (
    <div className={`p-4 rounded-2xl ${dt.bgSubtle} border ${dt.borderSubtle} mb-4`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className={`w-4 h-4 ${dt.text}`} />
        <span className="text-sm font-semibold">Grafik Performa</span>
        {performanceData && performanceData.totalWeeks > 0 && (
          <Badge className={`${dt.casinoBadge} text-[8px] ml-auto`}>
            {performanceData.totalWeeks} MINGGU
          </Badge>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1" role="tablist">
        {tabs.map(tab => (
          <TabButton
            key={tab.key}
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            icon={tab.icon}
            label={tab.label}
            division={playerDivision}
          />
        ))}
      </div>

      {/* Chart Content */}
      {isLoading ? (
        <ChartSkeleton />
      ) : isError ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          <BarChart3 className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
          Gagal memuat data performa
        </div>
      ) : !hasData ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          <BarChart3 className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
          Belum ada data performa mingguan
        </div>
      ) : (
        <>
          {/* ═══ Points Chart ═══ */}
          {activeTab === 'points' && (
            <ChartContainer config={pointsChartConfig} className="h-[220px] w-full aspect-auto">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id={`pointsGradient-${playerDivision}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="weekLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativePoints"
                  stroke={primaryColor}
                  strokeWidth={2.5}
                  fill={`url(#pointsGradient-${playerDivision})`}
                  dot={{ r: 3, fill: primaryColor, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: primaryColor, stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ChartContainer>
          )}

          {/* ═══ Win Rate Chart ═══ */}
          {activeTab === 'winrate' && (
            <ChartContainer config={winRateChartConfig} className="h-[220px] w-full aspect-auto">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="weekLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                />
                <ChartLegend
                  content={<ChartLegendContent />}
                />
                <Bar
                  yAxisId="left"
                  dataKey="wins"
                  stackId="winloss"
                  fill="#22C55E"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  yAxisId="left"
                  dataKey="losses"
                  stackId="winloss"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="winRate"
                  stroke={primaryColor}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: primaryColor, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: primaryColor, stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ChartContainer>
          )}

          {/* ═══ MVP Chart ═══ */}
          {activeTab === 'mvp' && (
            <ChartContainer config={mvpChartConfig} className="h-[220px] w-full aspect-auto">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="mvpGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FDE047" stopOpacity={1} />
                    <stop offset="95%" stopColor="#CA8A04" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="weekLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                />
                <Bar
                  dataKey="mvpCount"
                  fill="url(#mvpGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ChartContainer>
          )}

          {/* ═══ Rank Chart ═══ */}
          {activeTab === 'rank' && (() => {
            const maxRank = Math.max(...chartData.map(d => d.rank ?? 1), 1);
            return (
              <ChartContainer config={rankChartConfig} className="h-[220px] w-full aspect-auto">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="weekLabel"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    reversed
                    domain={[1, maxRank + 1]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `#${v}`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value: number) => `#${value}`} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="rank"
                    stroke={primaryColor}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: primaryColor, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: primaryColor, stroke: '#fff', strokeWidth: 2 }}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            );
          })()}

          {/* Quick stats below chart */}
          {activeTab === 'points' && performanceData && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="text-center p-2 rounded-xl bg-muted/5 border border-border/5">
                <p className="text-lg font-black" style={{ color: primaryColor }}>
                  {performanceData.weeklyPoints.length > 0
                    ? performanceData.weeklyPoints[performanceData.weeklyPoints.length - 1].cumulativePoints
                    : 0}
                </p>
                <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Total Poin</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-muted/5 border border-border/5">
                <p className="text-lg font-black text-yellow-500">
                  {performanceData.weeklyPoints.length > 0
                    ? Math.max(...performanceData.weeklyPoints.map(w => w.points))
                    : 0}
                </p>
                <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Tertinggi</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-muted/5 border border-border/5">
                <p className="text-lg font-black text-muted-foreground">
                  {performanceData.weeklyPoints.length > 0
                    ? Math.round(performanceData.weeklyPoints.reduce((a, b) => a + b.points, 0) / performanceData.weeklyPoints.length)
                    : 0}
                </p>
                <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Rata-rata</p>
              </div>
            </div>
          )}

          {activeTab === 'winrate' && performanceData && (() => {
            const totalWins = performanceData.winLossPerWeek.reduce((a, b) => a + b.wins, 0);
            const totalLosses = performanceData.winLossPerWeek.reduce((a, b) => a + b.losses, 0);
            const totalRate = (totalWins + totalLosses) > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0;
            return (
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center p-2 rounded-xl bg-green-500/5 border border-green-500/10">
                  <p className="text-lg font-black text-green-500">{totalWins}</p>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Total Menang</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-red-500/5 border border-red-500/10">
                  <p className="text-lg font-black text-red-500">{totalLosses}</p>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Total Kalah</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-muted/5 border border-border/5">
                  <p className={`text-lg font-black ${dt.neonGradient}`}>{totalRate}%</p>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Win Rate</p>
                </div>
              </div>
            );
          })()}

          {activeTab === 'mvp' && performanceData && (() => {
            const totalMvp = performanceData.mvpPerWeek.reduce((a, b) => a + b.mvpCount, 0);
            const bestWeek = performanceData.mvpPerWeek.reduce((best, w) => w.mvpCount > best.mvpCount ? w : best, { week: 0, mvpCount: 0 });
            return (
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center p-2 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                  <p className="text-lg font-black text-yellow-500">{totalMvp}</p>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Total MVP</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                  <p className="text-lg font-black text-yellow-500">{bestWeek.mvpCount}</p>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Terbanyak</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-muted/5 border border-border/5">
                  <p className="text-lg font-black text-muted-foreground">
                    {performanceData.mvpPerWeek.filter(w => w.mvpCount > 0).length}
                  </p>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Minggu MVP</p>
                </div>
              </div>
            );
          })()}

          {activeTab === 'rank' && performanceData && (() => {
            const bestRank = performanceData.rankProgress.length > 0
              ? Math.min(...performanceData.rankProgress.map(w => w.rank))
              : 0;
            const currentRank = performanceData.rankProgress.length > 0
              ? performanceData.rankProgress[performanceData.rankProgress.length - 1].rank
              : 0;
            return (
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center p-2 rounded-xl bg-muted/5 border border-border/5">
                  <p className="text-lg font-black" style={{ color: primaryColor }}>
                    {bestRank > 0 ? `#${bestRank}` : '-'}
                  </p>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Terbaik</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-muted/5 border border-border/5">
                  <p className="text-lg font-black text-muted-foreground">
                    {currentRank > 0 ? `#${currentRank}` : '-'}
                  </p>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Sekarang</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-muted/5 border border-border/5">
                  <p className="text-lg font-black text-muted-foreground">
                    {performanceData.rankProgress.length}
                  </p>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">Minggu Aktif</p>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
