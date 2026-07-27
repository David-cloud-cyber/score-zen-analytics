# Livefoot IA

Application de scores foot français & analytics IA.

## Stack
- **Frontend**: React 19, TanStack Router/Start (SSR), Tailwind CSS v4
- **Backend**: TanStack Start server functions (SSR via Nitro)
- **Database / Auth**: Supabase (`oirdlreedxhldmwadwom`)
- **Build**: Vite + `@lovable.dev/vite-tanstack-config`
- **Déploiement**: Cloudflare Workers (wrangler), domaine `www.livefoot.fun`
- **Package manager**: npm

## How to run
```
npm run dev
```
Runs on port 5000 (Replit webview).

## Key env vars (à définir comme secrets Replit)
| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase public key |
| `SUPABASE_URL` | Supabase URL (server-side) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase public key (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin, server-only) |
| `SUPABASE_MANAGEMENT_TOKEN` | Supabase PAT (migrations/management) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare deploy token |

## Custom domain
- **www.livefoot.fun** — géré via Cloudflare
- DNS pointe vers le worker Cloudflare déployé via wrangler

## Repository
https://github.com/David-cloud-cyber/score-zen-analytics

## User preferences
- Garder la structure existante du projet
- UI en français
- Le nom du site est **Livefoot IA** (pas ScoreZen)
- Toujours pusher les changements sur GitHub
- Les tokens/API keys ne doivent jamais être dans le code — utiliser les secrets Replit
