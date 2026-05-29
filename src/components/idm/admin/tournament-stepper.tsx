'use client';

import { memo, useState } from 'react';
import {
  Settings, ClipboardList, UserCheck, Users, Trophy, Gamepad2,
  Award, PartyPopper, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDivisionTheme } from '@/hooks/use-division-theme';

/* ===== Types ===== */
interface StepDef {
  key: string;
  label: string;
  shortLabel: string;
  icon: typeof Settings;
  desc: string;
  tip?: string;
}

/* ===== Step Definitions ===== */
const STEPS: StepDef[] = [
  { key: 'setup',              label: 'Setup',           shortLabel: 'Setup',   icon: Settings,       desc: 'Buat tournament baru', tip: 'Pastikan season aktif sebelum membuat tournament.' },
  { key: 'registration',       label: 'Registrasi',      shortLabel: 'Daftar',  icon: ClipboardList,  desc: 'Daftarkan pemain ke tournament', tip: 'Bisa approve satu per satu tanpa menunggu semua mendaftar.' },
  { key: 'approval',           label: 'Persetujuan',     shortLabel: 'Setujui', icon: UserCheck,      desc: 'Atur tier & setujui peserta', tip: 'Pastikan tier S = A = B untuk generate tim.' },
  { key: 'team_generation',    label: 'Buat Tim',        shortLabel: 'Tim',     icon: Users,          desc: 'Generate tim S+A+B', tip: 'Tim dinamai berdasarkan pemain Tier S.' },
  { key: 'bracket_generation', label: 'Bracket',         shortLabel: 'Bracket', icon: Trophy,         desc: 'Buat bracket pertandingan', tip: 'Format bracket mengikuti pengaturan tournament.' },
  { key: 'main_event',         label: 'Main Event',      shortLabel: 'Event',   icon: Gamepad2,       desc: 'Pertandingan berjalan', tip: 'Gunakan Quick Score Panel untuk input skor cepat.' },
  { key: 'finalization',       label: 'Finalisasi',      shortLabel: 'Final',   icon: Award,          desc: 'Pilih MVP & distribusi hadiah', tip: 'Setelah finalisasi, hadiah didistribusikan otomatis.' },
  { key: 'completed',          label: 'Selesai',         shortLabel: 'Selesai', icon: PartyPopper,    desc: 'Tournament selesai!' },
];

/* ===== Status Color Config ===== */
const STEP_COLORS: Record<string, { dot: string; bg: string; border: string; text: string; line: string }> = {
  setup:              { dot: 'bg-muted-foreground', bg: 'bg-muted/30',       border: 'border-border/30',        text: 'text-muted-foreground', line: 'bg-border/30' },
  registration:       { dot: 'bg-green-500',        bg: 'bg-green-500/5',    border: 'border-green-500/20',     text: 'text-green-500',        line: 'bg-green-500/30' },
  approval:           { dot: 'bg-yellow-500',       bg: 'bg-yellow-500/5',   border: 'border-yellow-500/20',    text: 'text-yellow-500',       line: 'bg-yellow-500/30' },
  team_generation:    { dot: 'bg-blue-500',         bg: 'bg-blue-500/5',     border: 'border-blue-500/20',      text: 'text-blue-500',         line: 'bg-blue-500/30' },
  bracket_generation: { dot: 'bg-blue-500',         bg: 'bg-blue-500/5',     border: 'border-blue-500/20',      text: 'text-blue-500',         line: 'bg-blue-500/30' },
  main_event:         { dot: 'bg-red-500',          bg: 'bg-red-500/5',      border: 'border-red-500/25',       text: 'text-red-500',          line: 'bg-red-500/30' },
  finalization:       { dot: 'bg-purple-500',       bg: 'bg-purple-500/5',   border: 'border-purple-500/20',    text: 'text-purple-500',       line: 'bg-purple-500/30' },
  completed:          { dot: 'bg-idm-gold-warm',    bg: 'bg-idm-gold-warm/5', border: 'border-idm-gold-warm/20', text: 'text-idm-gold-warm',   line: 'bg-idm-gold-warm/30' },
};

/* ===== Component ===== */
interface TournamentStepperProps {
  status: string;
  matchStats?: { live: number; ready: number; completed: number; total: number } | null;
  compact?: boolean;
}

export const TournamentStepper = memo(function TournamentStepper({
  status,
  matchStats,
  compact = false,
}: TournamentStepperProps) {
  const dt = useDivisionTheme();
  const [expanded, setExpanded] = useState(false);

  const currentIdx = STEPS.findIndex(s => s.key === status);
  const currentStep = STEPS[currentIdx];
  const currentColors = STEP_COLORS[status] || STEP_COLORS.setup;

  // Don't show stepper for completed tournaments in compact mode
  if (compact && status === 'completed') return null;

  /* ── Compact Mode: Inline progress bar with step dots ── */
  if (compact) {
    const progressPct = matchStats
      ? Math.round((matchStats.completed / Math.max(matchStats.total, 1)) * 100)
      : Math.round(((currentIdx + 1) / STEPS.length) * 100);

    return (
      <div className="space-y-1.5">
        {/* Status bar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {STEPS.slice(0, -1).map((step, i) => {
              const isCompleted = i < currentIdx;
              const isCurrent = i === currentIdx;
              const colors = STEP_COLORS[step.key] || STEP_COLORS.setup;
              return (
                <div
                  key={step.key}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    isCompleted ? 'bg-idm-gold-warm' :
                    isCurrent ? colors.dot :
                    'bg-muted-foreground/20'
                  } ${isCurrent ? 'ring-2 ring-offset-1 ring-offset-background' : ''}`}
                  style={isCurrent ? { ringColor: 'var(--idm-gold-warm, #d4a017)' } as React.CSSProperties : undefined}
                  title={step.label}
                />
              );
            })}
          </div>
          <span className="text-[10px] font-medium text-muted-foreground ml-auto">
            Step {currentIdx + 1}/{STEPS.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${currentColors.dot}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Current step label */}
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-semibold ${currentColors.text}`}>
            {currentStep?.shortLabel || 'Unknown'}
          </span>
          {matchStats && matchStats.total > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {matchStats.completed}/{matchStats.total} match
            </span>
          )}
        </div>
      </div>
    );
  }

  /* ── Full Mode: Expandable step list ── */
  return (
    <div className={`rounded-lg border ${currentColors.border} ${currentColors.bg} overflow-hidden transition-all`}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/10 transition-colors cursor-pointer text-left"
      >
        {/* Current step icon */}
        {currentStep && (
          <div className={`p-2 rounded-lg ${currentColors.bg} border ${currentColors.border} shrink-0`}>
            <currentStep.icon className={`w-4 h-4 ${currentColors.text}`} />
          </div>
        )}

        {/* Current step info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${currentColors.text}`}>
              {currentStep?.label || 'Unknown'}
            </span>
            <Badge className={`text-[10px] border-0 ${currentColors.bg} ${currentColors.text}`}>
              Step {currentIdx + 1}/{STEPS.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{currentStep?.desc}</p>
        </div>

        {/* Match stats if available */}
        {matchStats && matchStats.total > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {matchStats.live > 0 && (
              <Badge className="text-[10px] border-0 bg-red-500/10 text-red-500 gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {matchStats.live}
              </Badge>
            )}
            {matchStats.ready > 0 && (
              <Badge className="text-[10px] border-0 bg-green-500/10 text-green-500">{matchStats.ready} siap</Badge>
            )}
            <Badge className="text-[10px] border-0 bg-idm-gold-warm/10 text-idm-gold-warm">
              {matchStats.completed}/{matchStats.total}
            </Badge>
          </div>
        )}

        {/* Expand toggle */}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded: Full step timeline */}
      {expanded && (
        <div className="px-3 pb-3 space-y-0">
          {/* Step timeline */}
          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const isCompleted = i < currentIdx;
              const isCurrent = i === currentIdx;
              const isFuture = i > currentIdx;
              const colors = STEP_COLORS[step.key] || STEP_COLORS.setup;
              const StepIcon = step.icon;
              const isLast = i === STEPS.length - 1;

              return (
                <div key={step.key} className="flex gap-3">
                  {/* Left: dot + line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isCompleted
                          ? 'bg-idm-gold-warm/20 text-idm-gold-warm'
                          : isCurrent
                            ? `${colors.bg} border-2 ${colors.border} ${colors.text}`
                            : 'bg-muted/30 text-muted-foreground/40'
                      }`}
                    >
                      {isCompleted ? (
                        <span className="text-xs">✓</span>
                      ) : (
                        <StepIcon className="w-3 h-3" />
                      )}
                    </div>
                    {/* Connector line */}
                    {!isLast && (
                      <div
                        className={`w-0.5 h-6 transition-colors ${
                          isCompleted ? 'bg-idm-gold-warm/30' : 'bg-border/20'
                        }`}
                      />
                    )}
                  </div>

                  {/* Right: label + description */}
                  <div className={`pb-3 ${isLast ? '' : ''}`}>
                    <p
                      className={`text-xs font-semibold ${
                        isCompleted ? 'text-idm-gold-warm' :
                        isCurrent ? colors.text :
                        'text-muted-foreground/50'
                      }`}
                    >
                      {step.label}
                      {isCurrent && (
                        <span className="ml-1.5 text-[10px] font-normal text-idm-gold-warm/70">← anda di sini</span>
                      )}
                    </p>
                    {(isCurrent || isCompleted) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{step.desc}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tip for current step */}
          {currentStep?.tip && (
            <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-md bg-idm-gold-warm/5 border border-idm-gold-warm/10">
              <Info className="w-3 h-3 text-idm-gold-warm shrink-0 mt-0.5" />
              <p className="text-[11px] text-idm-gold-warm/80">{currentStep.tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
