# Livefoot IA

French football scores & AI analytics app.

## Stack
- **Frontend**: React 19, TanStack Router/Start (SSR), Tailwind CSS v4
- **Backend**: TanStack Start server functions (SSR via Nitro)
- **Database / Auth**: Supabase (`oirdlreedxhldmwadwom`)
- **Build**: Vite + `@lovable.dev/vite-tanstack-config`
- **Package manager**: npm

## How to run
```
npm run dev
```
Runs on port 5000 (Replit webview). The Lovable vite config defaults to 8080 but `vite.config.ts` overrides it to 5000 for Replit compatibility.

## Key env vars
| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase public (publishable) key |

Both are also hardcoded as fallbacks in `src/integrations/supabase/client.ts`.

## Custom domain
- **www.livefoot.fun** — managed via Cloudflare
- DNS should point to the deployed Replit app URL

## Repository
https://github.com/David-cloud-cyber/score-zen-analytics

## User preferences
- Keep existing project structure
- French-language UI
