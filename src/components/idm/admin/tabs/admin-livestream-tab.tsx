'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Radio,
  Youtube,
  Tv,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Eye,
  Users,
  Search,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/* ═══════════════════════════════════════════════════════
   ADMIN LIVE STREAM TAB
   Manages live stream entries (create, toggle, delete)
   ═══════════════════════════════════════════════════════ */

interface StreamData {
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

interface FormData {
  title: string;
  streamUrl: string;
  platform: string;
  division: string;
  tournamentId: string;
  thumbnail: string;
  viewerCount: string;
  isLive: boolean;
}

const emptyForm: FormData = {
  title: '',
  streamUrl: '',
  platform: 'youtube',
  division: '',
  tournamentId: '',
  thumbnail: '',
  viewerCount: '',
  isLive: false,
};

function detectPlatform(url: string): { platform: string; videoId: string | null; channelId: string | null } {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('twitch.tv')) {
    const match = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
    return { platform: 'twitch', videoId: null, channelId: match ? match[1] : null };
  }

  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return { platform: 'youtube', videoId: match ? match[1] : null, channelId: null };
  }

  return { platform: 'youtube', videoId: null, channelId: null };
}

function getEmbedUrl(stream: StreamData): string {
  if (stream.platform === 'youtube' && stream.videoId) {
    return `https://www.youtube.com/embed/${stream.videoId}?autoplay=0&rel=0&modestbranding=1`;
  }
  if (stream.platform === 'twitch' && stream.channelId) {
    return `https://player.twitch.tv/?channel=${stream.channelId}&parent=localhost`;
  }
  return '';
}

export function AdminLiveStreamTab({ division }: { division: string }) {
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewStream, setPreviewStream] = useState<StreamData | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const authFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  };

  // Fetch all streams
  const { data: streamsData, isLoading } = useQuery({
    queryKey: ['admin-livestreams', division],
    queryFn: async () => {
      const res = await authFetch(`/api/livestreams?limit=50`);
      if (!res.ok) throw new Error('Failed to fetch streams');
      return res.json();
    },
  });

  const streams: StreamData[] = streamsData?.streams || [];

  // Filter by search
  const filteredStreams = streams.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.platform.toLowerCase().includes(q) ||
      s.streamUrl.toLowerCase().includes(q)
    );
  });

  // Stats
  const liveCount = streams.filter(s => s.isLive).length;
  const totalStreams = streams.length;

  // Create stream mutation
  const createStream = useMutation({
    mutationFn: async (data: FormData) => {
      const detected = detectPlatform(data.streamUrl);
      const res = await authFetch('/api/livestreams', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          streamUrl: data.streamUrl,
          platform: detected.platform,
          videoId: detected.videoId,
          channelId: detected.channelId,
          isLive: data.isLive,
          division: data.division || null,
          tournamentId: data.tournamentId || null,
          thumbnail: data.thumbnail || null,
          viewerCount: data.viewerCount ? parseInt(data.viewerCount) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create stream');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-livestreams', division] });
      qc.invalidateQueries({ queryKey: ['livestreams'] });
      setIsCreateOpen(false);
      setForm(emptyForm);
      toast.success('Stream berhasil ditambahkan!');
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  // Toggle live mutation
  const toggleLive = useMutation({
    mutationFn: async ({ id, isLive }: { id: string; isLive: boolean }) => {
      const res = await authFetch(`/api/livestreams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isLive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to toggle stream');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-livestreams', division] });
      qc.invalidateQueries({ queryKey: ['livestreams'] });
      toast.success(variables.isLive ? 'Stream sekarang LIVE!' : 'Stream dihentikan');
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  // Update viewer count mutation
  const updateViewers = useMutation({
    mutationFn: async ({ id, viewerCount }: { id: string; viewerCount: number }) => {
      const res = await authFetch(`/api/livestreams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ viewerCount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update viewer count');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-livestreams', division] });
      qc.invalidateQueries({ queryKey: ['livestreams'] });
      toast.success('Viewer count diperbarui');
    },
  });

  // Delete stream mutation
  const deleteStream = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/livestreams/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete stream');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-livestreams', division] });
      qc.invalidateQueries({ queryKey: ['livestreams'] });
      toast.success('Stream berhasil dihapus');
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  // Auto-detect platform when URL changes
  const handleUrlChange = (url: string) => {
    const detected = detectPlatform(url);
    setForm(prev => ({
      ...prev,
      streamUrl: url,
      platform: detected.platform,
    }));
  };

  const openPreview = (stream: StreamData) => {
    setPreviewStream(stream);
    setIsPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-idm-gold-warm" />
          <h2 className="text-lg font-bold text-foreground">Live Stream</h2>
          {liveCount > 0 && (
            <Badge className="bg-red-500/15 text-red-500 text-[10px] border-0 px-1.5 py-0 flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              {liveCount} LIVE
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black gap-1 text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Stream
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl border border-border/20 bg-card/30 text-center">
          <p className="text-lg font-black text-foreground">{totalStreams}</p>
          <p className="text-[10px] font-medium text-muted-foreground">Total Stream</p>
        </div>
        <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-center">
          <p className="text-lg font-black text-red-500">{liveCount}</p>
          <p className="text-[10px] font-medium text-muted-foreground">Sedang Live</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Cari stream..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 text-sm h-9"
        />
      </div>

      {/* Streams List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : filteredStreams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Radio className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-bold text-muted-foreground/50">Belum ada stream</p>
          <p className="text-xs text-muted-foreground/40 mt-1">Klik &quot;Tambah Stream&quot; untuk menambah siaran</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[calc(100vh-380px)]">
          <div className="space-y-2 pr-2">
            {filteredStreams.map(stream => (
              <div
                key={stream.id}
                className={`p-3 rounded-xl border transition-all ${
                  stream.isLive
                    ? 'border-red-500/20 bg-red-500/[0.03]'
                    : 'border-border/20 bg-card/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Platform Icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    stream.platform === 'youtube' ? 'bg-red-500/10' : 'bg-purple-500/10'
                  }`}>
                    {stream.platform === 'youtube' ? (
                      <Youtube className="w-4.5 h-4.5 text-red-500" />
                    ) : (
                      <Tv className="w-4.5 h-4.5 text-purple-500" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground truncate">
                        {stream.title}
                      </span>
                      {stream.isLive && (
                        <Badge className="bg-red-500/15 text-red-500 text-[9px] border-0 px-1.5 py-0 h-4 flex items-center gap-0.5">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                          </span>
                          LIVE
                        </Badge>
                      )}
                      {stream.division && (
                        <Badge className={`text-[9px] border-0 px-1.5 py-0 h-4 ${
                          stream.division === 'male'
                            ? 'bg-cyan-500/15 text-cyan-400'
                            : 'bg-purple-500/15 text-purple-400'
                        }`}>
                          {stream.division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        {stream.platform === 'youtube' ? 'YouTube' : 'Twitch'}
                      </span>
                      {stream.viewerCount != null && (
                        <span className="flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" />
                          {stream.viewerCount}
                        </span>
                      )}
                      {stream.tournament && (
                        <span>Week {stream.tournament.weekNumber}</span>
                      )}
                      <span>
                        {new Date(stream.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    {/* Viewer Count Quick Update */}
                    {stream.isLive && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="Viewers"
                          defaultValue={stream.viewerCount ?? ''}
                          className="w-24 h-6 text-[10px] px-1.5 py-0"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value;
                              if (val) updateViewers.mutate({ id: stream.id, viewerCount: parseInt(val) });
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val && parseInt(val) !== stream.viewerCount) {
                              updateViewers.mutate({ id: stream.id, viewerCount: parseInt(val) });
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle Live */}
                    <button
                      onClick={() => toggleLive.mutate({ id: stream.id, isLive: !stream.isLive })}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                        stream.isLive
                          ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                          : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                      }`}
                      title={stream.isLive ? 'Stop stream' : 'Go live'}
                    >
                      {stream.isLive ? (
                        <ToggleRight className="w-3.5 h-3.5" />
                      ) : (
                        <Power className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Preview */}
                    <button
                      onClick={() => openPreview(stream)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-idm-gold-warm/10 text-idm-gold-warm hover:bg-idm-gold-warm/20 transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Open external */}
                    <a
                      href={stream.streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-muted/20 text-muted-foreground hover:bg-muted/30 transition-colors"
                      title="Open URL"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {/* Delete */}
                    <button
                      onClick={() => {
                        if (confirm('Hapus stream ini?')) {
                          deleteStream.mutate(stream.id);
                        }
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/5 text-red-500/60 hover:bg-red-500/15 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Create Stream Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-idm-gold-warm" />
              Tambah Live Stream
            </DialogTitle>
            <DialogDescription>
              Tambahkan siaran langsung dari YouTube atau Twitch
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Judul Stream *</label>
              <Input
                placeholder="Contoh: Grand Final Tarkam Week 10"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Stream URL */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">URL Stream *</label>
              <Input
                placeholder="https://youtube.com/watch?v=... atau https://twitch.tv/..."
                value={form.streamUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="text-sm"
              />
              {form.streamUrl && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-[9px] border-0 px-1.5 py-0 ${
                    form.platform === 'youtube' ? 'bg-red-500/15 text-red-500' : 'bg-purple-500/15 text-purple-500'
                  }`}>
                    {form.platform === 'youtube' ? (
                      <span className="flex items-center gap-1"><Youtube className="w-2.5 h-2.5" /> YouTube</span>
                    ) : (
                      <span className="flex items-center gap-1"><Tv className="w-2.5 h-2.5" /> Twitch</span>
                    )}
                  </Badge>
                  {(() => {
                    const detected = detectPlatform(form.streamUrl);
                    if (detected.videoId) return <span className="text-[10px] text-muted-foreground">Video ID: {detected.videoId}</span>;
                    if (detected.channelId) return <span className="text-[10px] text-muted-foreground">Channel: {detected.channelId}</span>;
                    return null;
                  })()}
                </div>
              )}
            </div>

            {/* Division + IsLive */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Divisi</label>
                <select
                  value={form.division}
                  onChange={(e) => setForm(prev => ({ ...prev, division: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-border/30 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-idm-gold-warm/50"
                >
                  <option value="">Semua (Both)</option>
                  <option value="male">🕺 Cowo</option>
                  <option value="female">💃 Cewe</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</label>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, isLive: !prev.isLive }))}
                  className={`w-full h-9 px-3 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    form.isLive
                      ? 'border-red-500/30 bg-red-500/10 text-red-500'
                      : 'border-border/30 bg-muted/20 text-muted-foreground'
                  }`}
                >
                  {form.isLive ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                      LIVE
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4" />
                      Offline
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Thumbnail URL */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Thumbnail URL (opsional)</label>
              <Input
                placeholder="https://..."
                value={form.thumbnail}
                onChange={(e) => setForm(prev => ({ ...prev, thumbnail: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Viewer Count */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jumlah Viewer (opsional)</label>
              <Input
                type="number"
                placeholder="0"
                value={form.viewerCount}
                onChange={(e) => setForm(prev => ({ ...prev, viewerCount: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Submit */}
            <Button
              onClick={() => createStream.mutate(form)}
              disabled={!form.title.trim() || !form.streamUrl.trim() || createStream.isPending}
              className="w-full bg-idm-gold-warm hover:bg-idm-gold-warm/80 text-black font-bold text-sm gap-2"
            >
              {createStream.isPending ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Tambah Stream
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-idm-gold-warm" />
              Preview: {previewStream?.title}
            </DialogTitle>
            <DialogDescription>
              Preview embed stream
            </DialogDescription>
          </DialogHeader>

          {previewStream && (
            <div className="space-y-3">
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                {(() => {
                  const embedUrl = getEmbedUrl(previewStream);
                  if (embedUrl) {
                    return (
                      <iframe
                        src={embedUrl}
                        title={previewStream.title}
                        className="absolute inset-0 w-full h-full"
                        allow="autoplay; encrypted-media; fullscreen"
                        allowFullScreen
                        style={{ border: 'none' }}
                      />
                    );
                  }
                  return (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/10">
                      <Radio className="w-10 h-10 text-idm-gold-warm/30" />
                      <p className="text-sm text-muted-foreground">Embed tidak tersedia</p>
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-[10px] border-0 ${
                  previewStream.platform === 'youtube' ? 'bg-red-500/15 text-red-500' : 'bg-purple-500/15 text-purple-500'
                }`}>
                  {previewStream.platform === 'youtube' ? 'YouTube' : 'Twitch'}
                </Badge>
                {previewStream.isLive && (
                  <Badge className="bg-red-500/15 text-red-500 text-[10px] border-0">
                    LIVE
                  </Badge>
                )}
                {previewStream.division && (
                  <Badge className={`text-[10px] border-0 ${
                    previewStream.division === 'male'
                      ? 'bg-cyan-500/15 text-cyan-400'
                      : 'bg-purple-500/15 text-purple-400'
                  }`}>
                    {previewStream.division === 'male' ? '🕺 Cowo' : '💃 Cewe'}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
