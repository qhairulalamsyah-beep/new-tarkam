# Task 9 — FAQ / Help Center Page

## Agent: main

## Summary
Implemented a comprehensive FAQ / Help Center page for the TARKAM IDM esports tournament website with Indonesian content, search, category filtering, accordion-style FAQ items, and a contact section.

## Files Modified
1. `/src/lib/store.ts` — Added 'faq' to AppView type
2. `/src/components/idm/faq-page.tsx` — NEW: Full FAQ page component (22 items, 5 categories, search, contact)
3. `/src/components/idm/landing-page.tsx` — Added HelpCircle icon + "Bantuan" nav (desktop + mobile)
4. `/src/components/idm/public-page-layout.tsx` — Added HelpCircle icon + "Bantuan" nav (desktop + mobile)
5. `/src/components/idm/app-shell.tsx` — Dynamic import FaqPage, publicViews, renderPublicView, isFullBleed, view name map

## Key Decisions
- Used shadcn/ui Accordion component for FAQ items (single collapsible per item)
- Used dangerouslySetInnerHTML for FAQ answers to support rich HTML (lists, bold, emphasis)
- 22 FAQ items across 5 categories (exceeds the 20 minimum requirement)
- Mobile bottom nav: replaced Bracket with Bantuan to stay within 6 items (Bracket still accessible via desktop nav)
- Contact section: Discord (purple), WhatsApp (green), Email (idm-gold-warm)

## Status: COMPLETED
