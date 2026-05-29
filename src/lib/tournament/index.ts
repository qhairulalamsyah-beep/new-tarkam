/**
 * Tournament Module
 * Export all tournament-related utilities and functions
 */

// Export everything from tournament-utils (primary utility module)
export * from './tournament-utils'

// Export only unique functions from bracket-generator (excluding duplicates)
export {
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  generateGroupStage,
  generateSwiss,
  generatePlayoff,
  getRoundName,
  getBracketRoundLabel,
} from './bracket-generator'

// ⚠️ DEPRECATED — match-advancement exports are NOT used by the Tarkam engine.
// The actual advancement logic is in src/app/api/tournaments/[id]/score/route.ts.
// These exports are kept for reference only — do not import in production code.
export {
  advanceWinner,
  updateBracket,
  calculateGroupStandings,
} from './match-advancement'
export type { AdvancementResult } from './match-advancement'
