# Design system (Phase 3)

Plain CSS with design tokens (`apps/web/src/styles/tokens.css`). Tailwind from the original plan was
dropped: fewer moving parts, and tokens make contrast checks and dark mode simple. System font stack, so
no third-party font requests (privacy + strict CSP later).

## Accessibility decisions
- Skip link, landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, per-page `<title>`.
- Focus moves to `<main>` after navigation; visible 3px focus ring in both themes.
- Every input has a visible label, hint and error linked with `aria-describedby`; errors use text + icon, never colour alone.
- `ConfidenceBadge` shows dots + words, not only colour.
- `prefers-color-scheme` dark theme and `prefers-reduced-motion` respected.
- Touch targets at least 44px tall.

## Measured contrast (WCAG ratios, computed 2026-10-04; AA needs 4.5 for text, 3.0 for UI)
| Pair | Light | Dark |
|---|---|---|
| Body text on background | 15.05 | 15.99 |
| Muted text on surface | 7.69 | 8.20 |
| Accent link on background | 7.51 | 8.97 |
| Button text on accent | 8.00 | 9.01 |
| Note text on note background | 13.53 | 12.97 |
| Success badge text | 7.05 | 9.28 |
| Warning/error text | 6.70 | 10.00 |
| Input border vs background (UI, 3.0) | 3.73 | 4.31 |
| Focus ring vs background (UI, 3.0) | 6.29 | 8.95 |

Not yet done: automated axe-core checks, screen-reader testing, real-device tests (Phase 14).
