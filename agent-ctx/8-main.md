# Task 8 — Comments/Reactions System

## Summary
Implemented a complete Comments/Reactions system for the TARKAM IDM esports tournament website, allowing users to react with emoji and comment on match results and highlights.

## Files Created
- `prisma/schema.prisma` — Added Reaction and Comment models
- `src/app/api/reactions/route.ts` — GET/POST/DELETE reactions API
- `src/app/api/comments/route.ts` — GET/POST comments API
- `src/app/api/comments/[id]/route.ts` — DELETE comment API (soft delete)
- `src/components/idm/reactions-bar.tsx` — ReactionsBar component (full + compact modes)
- `src/components/idm/comments-section.tsx` — CommentsSection component with nested replies

## Files Modified
- `src/lib/queries/misc.ts` — Added query functions: getReactions, toggleReaction, getComments, createComment, deleteComment
- `src/lib/hooks.ts` — Added hooks: useReactions, useComments
- `src/components/idm/match-detail-page.tsx` — Integrated ReactionsBar + CommentsSection
- `src/components/idm/landing/hasil-section.tsx` — Added compact ReactionsBar to all match row variants
- `worklog.md` — Appended task work log

## Key Design Decisions
- Toggle-based reactions: clicking same emoji again removes it (like/unlike pattern)
- One reaction per type per user per target (unique constraint)
- One level of nesting for comment replies (no replies to replies)
- Soft delete for comments (isDeleted flag, content replaced with '[deleted]')
- Cursor-based pagination for comments (not offset-based)
- 15s staleTime for reactions/comments queries (very dynamic data)
- Compact mode ReactionsBar only shows reactions with counts > 0 or user's own
- onClick stopPropagation on compact reaction bars to prevent match detail opening from HasilSection
