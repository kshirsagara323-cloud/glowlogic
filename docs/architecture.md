# Architecture decisions (Phase 1, checked 2026-10-04)

| Layer | Choice | Evidence / reason |
|---|---|---|
| Web | React + Vite + TypeScript on Cloudflare Pages | Free tier permits commercial use; Vercel Hobby is non-commercial only |
| API | Node + Express + TypeScript on Render free | Free services sleep after 15 min idle (about 1 min wake-up); keep-alive ping planned |
| Database + Auth | Supabase | Free plan: 500 MB DB, 50k MAU, 2 projects, pauses after 7 days idle (confirm on supabase.com/pricing) |
| NOT used | Render Postgres | Free databases expire after 30 days and have no backups |
| Photo analysis | MediaPipe Face Landmarker (Apache-2.0), self-hosted model + WASM | Runs in the browser; no third-party requests during analysis |
| Product data | Curated core + Open Beauty Facts layer | ODbL: attribution + share-alike; keep OBF-derived data flagged by source |

Still to verify when needed: CosIng terms, Kaggle/Makeup API licences, Sentry/UptimeRobot limits,
GitHub Actions minutes, Razorpay/Stripe test mode, MediaPipe model-file licence.
