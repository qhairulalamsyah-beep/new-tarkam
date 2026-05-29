'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, TrendingUp, Undo2, Play, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';

/* ===== Types ===== */
interface AuditLogEntry {
  id: string;
  adminId?: string | null;
  adminName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  metadata?: string | null;
  createdAt: string;
}

/* ===== Helpers ===== */
function parseMetadata(metadata: string | null | undefined): Record<string, unknown> | null {
  if (!metadata) return null;
  try { return JSON.parse(metadata); } catch { return null; }
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Baru saja';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m lalu`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h lalu`;
  return `${Math.floor(diff / 86400000)}h lalu`;
}

/* ===== Component ===== */
interface ScoreAuditFeedProps {
  limit?: number;
}

export function ScoreAuditFeed({ limit = 8 }: ScoreAuditFeedProps) {
  const dt = useDivisionTheme();

  // Fetch match-related audit logs
  const { data, isLoading } = useQuery({
    queryKey: ['admin-score-audit', limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-logs?entity=match&limit=${limit}`, {
        credentials: 'include',
      });
      if (!res.ok) return { logs: [], total: 0 };
      return res.json() as Promise<{ logs: AuditLogEntry[]; total: number }>;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const logs = data?.logs || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">Belum ada aktivitas skor</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
      {logs.map((log) => {
        const meta = parseMetadata(log.metadata);
        const isScore = log.details?.includes('score') || log.details?.includes('Score');
        const isStart = log.details?.includes('start') || log.details?.includes('Start');
        const isUndo = log.action === 'undo' || log.details?.toLowerCase().includes('undo');

        // Extract score from details
        const scoreMatch = log.details?.match(/(\d+)\s*[-–]\s*(\d+)/);
        const score1 = scoreMatch ? scoreMatch[1] : null;
        const score2 = scoreMatch ? scoreMatch[2] : null;

        return (
          <div
            key={log.id}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-xs transition-colors ${
              isUndo
                ? 'bg-orange-500/5 border border-orange-500/10'
                : isScore
                  ? 'bg-green-500/5 border border-green-500/10'
                  : isStart
                    ? 'bg-blue-500/5 border border-blue-500/10'
                    : 'bg-muted/15 border border-border/5'
            }`}
          >
            {/* Icon */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              isUndo ? 'bg-orange-500/10 text-orange-500' :
              isScore ? 'bg-green-500/10 text-green-500' :
              isStart ? 'bg-blue-500/10 text-blue-500' :
              'bg-muted/30 text-muted-foreground'
            }`}>
              {isUndo ? <Undo2 className="w-3 h-3" /> :
               isScore ? <TrendingUp className="w-3 h-3" /> :
               isStart ? <Play className="w-3 h-3" /> :
               <Clock className="w-3 h-3" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate">
                  {isUndo ? 'Undo Skor' :
                   isScore ? 'Submit Skor' :
                   isStart ? 'Start Match' :
                   log.details || log.action}
                </span>
                {score1 && score2 && (
                  <Badge className={`text-[10px] border-0 px-1.5 py-0 ${
                    isUndo ? 'bg-orange-500/10 text-orange-400' : 'bg-idm-gold-warm/10 text-idm-gold-warm'
                  }`}>
                    {score1}-{score2}
                  </Badge>
                )}
              </div>
              {log.adminName && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  oleh {log.adminName}
                </p>
              )}
            </div>

            {/* Time */}
            <span className="text-[10px] text-muted-foreground/60 shrink-0">
              {formatTimeAgo(log.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
