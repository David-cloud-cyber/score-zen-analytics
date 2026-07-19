## LiveFoot AI — Frontend-only build

Direction retenue : **Direct broadcast** (light Swiss-grid, typographie grotesque, accents brand `#10b981` et data `#3b82f6`). Aucune connexion Supabase, aucune API sportive, aucun modèle IA — uniquement UI premium mobile-first avec données fictives réalistes.

### Design system
- Tokens dans `src/styles.css` : `background` neutral-50, `foreground` neutral-900, `brand` #10b981, `accent` #3b82f6, `surface` neutral-100, `border` neutral-950/5, `alert` #ef4444. Radius généreux (16-24px). Police Inter (via `<link>` dans `__root.tsx`), variante display en tracking serré.
- Container mobile `max-w-[420px]` centré, header sticky, bottom nav sticky (safe area).
- Composants shadcn utilisés : Tabs, Card, Button, Input, Badge, Sheet, Avatar, Progress, ScrollArea, Tooltip.

### Routes (`src/routes/`)
1. `index.tsx` → **Matchs du jour** : header (logo, crédits, notifs), tabs "En direct / À venir / Terminés", groupes par compétition (Ligue 1, PL, Liga, Serie A, UCL) avec cartes de match (blasons SVG mock, score, minute pulsée, xG mini). CTA flottant "Analyser 2 équipes".
2. `match.$id.tsx` → **Fiche match** : hero score, tabs Stats / Timeline / Compositions / H2H / IA.
   - Stats : barres comparatives (possession, tirs, xG, corners, cartons, passes réussies %).
   - Timeline : événements minute par minute (buts, cartons, changements).
   - Compositions : **terrain 2D SVG** avec joueurs positionnés, **heatmap joueur** au tap (mock overlay radial-gradient).
   - H2H : 5 derniers face-à-face, form guide W/D/L pills.
   - IA : donut probabilités 1X2, score probable, marchés (BTTS, O/U 2.5, Double Chance, Score exact, Buteurs, Corners, Cartons) chacun avec % confiance + badge risque + disclaimer.
3. `analyse.tsx` → **Comparateur** : 2 inputs avec autocomplete mock (Real Madrid, Barcelona, PSG…), bouton "Lancer l'analyse" → panneau résultat identique au tab IA + chat conversationnel (bulles user/IA mockées, PromptInput bloqué avec disclaimer "Démo — pas d'appel IA").
4. `favoris.tsx` → équipes/joueurs/compétitions favoris, alertes de buts toggles.
5. `profil.tsx` → avatar, plan actuel (Free/Premium), crédits, historique d'analyses, paramètres notifications, **carte upsell Premium** (analyses illimitées, statistiques avancées, alertes premium).
6. `_root` : head SEO FR ("LiveFoot AI — Livescore et analyses football en temps réel"), footer légal léger dans la home uniquement.

### Composants clés (`src/components/`)
- `AppShell` (header sticky + bottom nav 4 onglets : Matchs / Analyse / Favoris / Profil, actif = brand).
- `MatchCard`, `LeagueGroup`, `LiveMinuteBadge`, `ScorePill`.
- `StatBar` (barre comparative bicolore avec valeurs).
- `WinProbabilityDonut` (SVG conic 3 segments + légende).
- `MarketCard` (marché + confiance % + badge risque bas/moyen/élevé).
- `PitchFormation` (SVG terrain vertical avec 11 pastilles joueurs + numéros ; tap = surbrillance + heatmap radial-gradient overlay).
- `PlayerHeatmap` (SVG rect terrain + 6-8 radial-gradients pondérés).
- `FormGuide` (5 pastilles V/N/D colorées).
- `TimelineEvent`, `H2HRow`, `AiChatBubble`, `Disclaimer`.
- `TeamCrest` (SVG mock : cercle + initiales couleur club).

### Données fictives (`src/data/`)
- `teams.ts` (30 clubs, couleurs, blasons initiales), `competitions.ts`, `matches.ts` (12 matchs live/à venir/terminés avec stats complètes), `players.ts` (compositions Real vs Barça + positions x/y), `analyses.ts` (predictions, marchés, texte IA préécrit FR).

### Animations
- Utilitaires Tailwind existants (`animate-fade-in`, `animate-scale-in`) + keyframe `pulse-dot` pour la minute live et `grow-bar` (transform scaleX) pour les barres au mount via `animation-delay` en cascade.

### Détails techniques
- Chaque route a son propre `head()` (title/description/og FR).
- `set_preview_device_viewport` → mobile pour construire.
- Aucun backend : tout est importé statiquement depuis `src/data/`.
- Le placeholder `src/routes/index.tsx` est remplacé par la home Matchs.
- Bottom nav utilise `<Link>` de `@tanstack/react-router` avec `activeProps`.

### Hors scope (explicitement reporté)
- Supabase / auth / DB / RLS.
- API football réelles.
- Appels IA réels (le chat est visuel uniquement).
- Paiements Premium (carte upsell purement UI).
