'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radio, Youtube, Tv, Users, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getLiveStreams } from '@/lib/queries';

/* ═══════════════════════════════════════════════════════════════
   TARKAM IDM — LIVE STREAM SECTION
   Casino-card styled live stream embed section
   Shows YouTube/Twitch embeds when streams are active
   ═══════════════════════════════════════════════════════════════ */

interface LiveStreamData {
  id: string;
  title: string;
  platform: string;
  streamUrl: string;
  videoId: string | null;
  channelId: string | null;
  isLive: boolean;
  startedAt: string | null;
  division: string | null;
  tournamentId: string | null;
  thumbnail: string | null;
  viewerCount: number | null;
  createdAt: string;
  tournament?: {
    id: string;
    name: string;
    weekNumber: number;
    division: string;
  } | null;
}

function getEmbedUrl(stream: LiveStreamData): string {
  if (stream.platform === 'youtube' && stream.videoId) {
    return `https://www.youtube.com/embed/${stream.videoId}?autoplay=1&rel=0&modestbranding=1`;
  }
  if (stream.platform === 'twitch' && stream.channelId) {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `https://player.twitch.tv/?channel=${stream.channelId}&parent=${hostname}&autoplay=true`;
  }
  return '';
}

function formatViewerCount(count: number | null): string {
  if (!count) return '';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function DivisionBadge({ division }: { division: string | null }) {
  if (!division) return null;
  const isMale = division === 'male';
  return (
    <Badge
      className={`text-[10px] font-bold border-0 px-2 py-0.5 ${
        isMale
          ? 'bg-cyan-500/15 text-cyan-400'
          : 'bg-purple-500/15 text-purple-400'
      }`}
    >
      {isMale ? '🕺 Cowo' : '💃 Cewe'}
    </Badge>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'youtube') {
    return <Youtube className="w-4 h-4 text-red-500" />;
  }
  return <Tv className="w-4 h-4 text-purple-500" />;
}

export function LiveStreamSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['livestreams', undefined, true, 10],
    queryFn: () => getLiveStreams({ liveOnly: true, limit: 10 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const streams: LiveStreamData[] = data?.streams || [];
  const activeStreams = streams.filter(s => s.isLive);

  // Don't render if no active streams
  if (isLoading) {
    return (
      <section className="relative py-6 px-4" aria-label="Live Stream">
        <div className="max-w-5xl mx-auto">
          <div className="casino-card p-6 rounded-2xl border border-idm-gold-warm/15 bg-background/50 animate-pulse">
            <div className="aspect-video rounded-xl bg-muted/20" />
          </div>
        </div>
      </section>
    );
  }

  if (activeStreams.length === 0) return null;

  const currentStream = activeStreams[activeIndex] || activeStreams[0];
  const embedUrl = getEmbedUrl(currentStream);

  const goToPrev = () => {
    setActiveIndex(prev => (prev - 1 + activeStreams.length) % activeStreams.length);
  };

  const goToNext = () => {
    setActiveIndex(prev => (prev + 1) % activeStreams.length);
  };

  return (
    <section className="relative py-6 sm:py-8 px-4" aria-label="Live Stream">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Pulsing LIVE Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 shadow-[0_0_16px_rgba(239,68,68,0.15)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-xs font-black text-red-400 uppercase tracking-wider">LIVE</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-gradient-fury uppercase tracking-wide">
              Siaran Langsung
            </h2>
          </div>

          {/* Stream Navigation */}
          {activeStreams.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrev}
                className="w-8 h-8 rounded-lg border border-idm-gold-warm/20 bg-idm-gold-warm/5 hover:bg-idm-gold-warm/15 flex items-center justify-center text-idm-gold-warm/70 hover:text-idm-gold-warm transition-all cursor-pointer active:scale-95"
                aria-label="Previous stream"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground font-medium tabular-nums">
                {activeIndex + 1}/{activeStreams.length}
              </span>
              <button
                onClick={goToNext}
                className="w-8 h-8 rounded-lg border border-idm-gold-warm/20 bg-idm-gold-warm/5 hover:bg-idm-gold-warm/15 flex items-center justify-center text-idm-gold-warm/70 hover:text-idm-gold-warm transition-all cursor-pointer active:scale-95"
                aria-label="Next stream"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Main Stream Card */}
        <div className="casino-card rounded-2xl border border-idm-gold-warm/15 bg-background/50 overflow-hidden shadow-lg shadow-black/20">
          {/* Video Embed — 16:9 aspect ratio */}
          <div className="relative w-full aspect-video bg-black">
            {embedUrl ? (
              <iframe
                key={currentStream.id}
                src={embedUrl}
                title={currentStream.title}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                style={{ border: 'none' }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/10">
                <Radio className="w-12 h-12 text-idm-gold-warm/30" />
                <p className="text-sm text-muted-foreground">Stream tidak dapat dimuat</p>
                <a
                  href={currentStream.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-idm-gold-warm/10 border border-idm-gold-warm/20 text-idm-gold-warm text-xs font-semibold hover:bg-idm-gold-warm/20 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Tonton di {currentStream.platform === 'youtube' ? 'YouTube' : 'Twitch'}
                </a>
              </div>
            )}

            {/* Live indicator overlay — top-left */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-600/90 backdrop-blur-sm shadow-lg">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                <span className="text-[10px] font-black text-white uppercase tracking-wider">LIVE</span>
              </div>
              {currentStream.viewerCount && currentStream.viewerCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm">
                  <Users className="w-3 h-3 text-white/80" />
                  <span className="text-[10px] font-bold text-white/90 tabular-nums">
                    {formatViewerCount(currentStream.viewerCount)}
                  </span>
                </div>
              )}
            </div>

            {/* Platform badge — top-right */}
            <div className="absolute top-3 right-3 z-10">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm">
                <PlatformIcon platform={currentStream.platform} />
                <span className="text-[10px] font-bold text-white/80 uppercase">
                  {currentStream.platform}
                </span>
              </div>
            </div>
          </div>

          {/* Stream Info Bar */}
          <div className="p-4 sm:p-5 border-t border-idm-gold-warm/10 bg-gradient-to-r from-idm-gold-warm/[0.03] to-transparent">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <PlatformIcon platform={currentStream.platform} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                    {currentStream.title}
                  </h3>
                  {currentStream.tournament && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {currentStream.tournament.name} — Week {currentStream.tournament.weekNumber}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <DivisionBadge division={currentStream.division} />
                <a
                  href={currentStream.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-idm-gold-warm/10 border border-idm-gold-warm/20 text-idm-gold-warm text-[11px] font-semibold hover:bg-idm-gold-warm/20 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="hidden sm:inline">Buka</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Stream Tabs (multiple streams) */}
        {activeStreams.length > 1 && (
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-thin">
            {activeStreams.map((stream, idx) => (
              <button
                key={stream.id}
                onClick={() => setActiveIndex(idx)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  idx === activeIndex
                    ? 'border-idm-gold-warm/30 bg-idm-gold-warm/10 text-idm-gold-warm'
                    : 'border-border/30 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border/50'
                }`}
              >
                <PlatformIcon platform={stream.platform} />
                <span className="truncate max-w-[120px]">{stream.title}</span>
                {stream.isLive && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
