# KvK Appointment Planner

KvK appointment sign-ups and schedule for our Kingshot alliance. Next.js (App Router) + Tailwind + shadcn/ui, with Convex for the database and server functions.

## Pages

| Page | Path |
| --- | --- |
| Sign-up (home) | `/` |
| Public schedule | `/schedule` |
| Admin | `/admin` |

## Development

```bash
pnpm install
pnpm convex dev   # keeps Convex functions in sync, writes .env.local
pnpm dev          # http://localhost:3000
```

Set the admin password on the Convex deployment (dashboard → Settings → Environment Variables, or):

```bash
pnpm convex env set ADMIN_PASSWORD 'your-password'
```

## Layout

- `src/app/` — routes (`/`, `/schedule`, `/admin`)
- `src/components/kvk/` — planner UI; `src/components/site-nav.tsx` links every page
- `convex/kvk/` — Convex functions; `convex/schema.ts` holds all tables
- `convex/lib/kvk.ts` — ranking and auto-assign logic (shared with the browser)

## Deploying (Vercel)

1. In the Convex dashboard, generate a Production deploy key and add it to Vercel as `CONVEX_DEPLOY_KEY`.
2. Set the Vercel build command to `pnpm convex deploy --cmd 'pnpm build'`.
3. `pnpm convex env set --prod ADMIN_PASSWORD 'your-password'`.
