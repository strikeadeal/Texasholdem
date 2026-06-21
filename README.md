# The Back Room — Texas Hold'em

A late-night, back-room poker table you play on your iPhone. Add it to your Home
Screen and it runs fullscreen and offline — no browser chrome, no account, no
server. Sit down against five computer opponents in a six-handed no-limit cash
game, rebuy whenever you bust, and play one hand at a time.

> Play money only. No real-money wagering, no online multiplayer.

## The look

Worn forest-green felt, a beveled brass rail framing the screen, aged-ivory
cards with paper grain and burnished-gold accents, dark mahogany, low light —
legible at arm's length and glanceable during play. Face cards are typographic
(suit + monogram), never illustrated. Type is set in **Marcellus** (engraved
brass-plate display) and **Spectral** (body), bundled for offline use.

## Tech

- **Vite + React + TypeScript**
- **vite-plugin-pwa (Workbox)** — installable, offline precache, service worker
- **Zustand** store wrapping a pure-TypeScript game engine
- **Framer Motion** for dealing/chip/flip motion (gated by `prefers-reduced-motion`)
- Plain CSS + CSS custom properties (design tokens) + CSS Modules; cards and
  chips are SVG
- **Vitest** for the engine

The poker engine (`src/engine/`) is framework-agnostic and pure: a 7-card hand
evaluator, a no-limit betting state machine with full **side-pot** logic for
multiple all-ins, blind posting (including the heads-up rule), and Monte-Carlo
AI opponents with distinct personalities.

## Run it

```bash
npm install
npm run dev        # development server
npm run test       # engine unit tests (Vitest)
npm run build      # production build (PWA service worker + manifest)
npm run preview    # serve the production build
```

## Install on iPhone

1. Open the deployed URL (or the `preview` server) in Safari.
2. Tap **Share → Add to Home Screen**.
3. Launch from the Home Screen — it opens fullscreen in portrait, respects the
   notch and home indicator, and works offline. Your stacks and the current hand
   persist across closes.

## Project layout

```
src/
  engine/      cards, evaluator, betting state machine, side pots, AI (+ tests)
  store/       Zustand store: drives the engine loop, AI turns, persistence
  components/  BrassRail, Table, Seat, Card, Board, Pot, ChipStack,
               ActionBar, RaiseControl, HandLog, FirstRun, RebuyDialog
  styles/      design tokens, global resets, fonts
  hooks/       useReducedMotion
public/        app icons (192 / 512 / maskable) + apple-touch-icon
```

## How a hand flows

Deal me in → blinds posted, hole cards dealt → betting (Fold / Check / Call /
Bet / Raise with min · ½ pot · pot · all-in) → flop, turn, river → showdown and
payout → next hand. Bust to zero and you're offered a rebuy.
