# Codes promo bookmakers — hub + pages articles SEO

Nouvel espace « Codes promo » : une page-liste de tous les codes partenaires, et pour chaque bookmaker une page-article longue, très optimisée SEO, avec le code, le bonus, la bannière affiliée et les CTA.

## Contenu au lancement

**1win** — code `PREDAT`, bonus jusqu'à 130 000 FCFA, lien `https://lkfg.pro/a66a894d`, bannière `one-vv0931.com/?p=iezl`.

La structure est prévue pour ajouter Melbet, 1xBet, Betwinner, etc. plus tard : un seul objet à copier dans le fichier de contenu et la page + le sitemap se génèrent automatiquement.

## Pages

### `/codes-promo` — le hub
- Titre + intro SEO (200-300 mots, « meilleurs codes promo bookmakers 2026 »).
- Grille de cartes bookmaker : logo/couleur, note sur 5, bonus principal, **code affiché avec bouton « Copier »** (feedback « Copié ! »), bouton « Voir l'offre » (lien affilié, `target=_blank`, `rel="sponsored noopener"`) et « Lire l'analyse » vers la page dédiée.
- Tableau comparatif rapide (bonus / code / dépôt min / note).
- Bloc FAQ courte + avertissement jeu responsable (18+, ANJ/ARJEL).

### `/codes-promo/$slug` — l'article par bookmaker
Article long (1 500+ mots) structuré comme les références envoyées :
1. Hero : nom, note, code en gros avec copie, bonus, CTA + bannière affiliée.
2. Sommaire cliquable (ancres).
3. « Qu'est-ce que le code promo PREDAT ? »
4. « Comment utiliser le code » — étapes numérotées d'inscription.
5. « Détails du bonus de bienvenue » — tableau (montant max, dépôt min, wager, délai, sports éligibles).
6. « Conditions générales du bonus » — liste.
7. « Offres et promotions permanentes ».
8. « Dépôts et retraits » — moyens de paiement mobile money Afrique.
9. « Application mobile », « Service client », « Sécurité et licence ».
10. « Avis LiveFoot AI » — points forts / points faibles.
11. FAQ (6-8 questions).
12. Bloc jeu responsable + CTA final.

Chaque section provient de données typées, donc pas de HTML dupliqué entre bookmakers.

## SEO

- `head()` propre par page : title, description, og:*, twitter:*, canonical auto-référencé, og:image = bannière du bookmaker.
- JSON-LD : `Article` + `FAQPage` + `BreadcrumbList` + `Review` (note/aggregateRating) sur chaque page bookmaker ; `ItemList` sur le hub.
- Fil d'Ariane visible (Accueil › Codes promo › 1win).
- Maillage interne : hub ↔ articles, et lien depuis le footer/sidebar.
- Ajout de `/codes-promo` et de chaque `/codes-promo/$slug` dans `sitemap.xml` (généré depuis le fichier de contenu, donc jamais oublié).
- Tous les liens sortants affiliés en `rel="sponsored noopener nofollow"` — conforme aux consignes Google, évite la pénalité.
- Mise à jour de `public/llms.txt` avec les nouvelles pages.

## Navigation

- Entrée **« Codes promo »** (icône ticket) dans la sidebar desktop, sous « Communauté ».
- Mobile : la barre du bas reste à 5 onglets inchangée ; accès via la recherche (SmartSearch) + un lien dans le footer de la page d'accueil et dans le menu Profil.

## Détails techniques

- `src/data/bookmakers.ts` : tableau typé `Bookmaker[]` (slug, nom, code, bonus, liens affilié/bannière, note, couleurs, sections, FAQ, tableau conditions). Contenu statique dans le code, rendu en SSR → indexation parfaite.
- `src/routes/codes-promo.tsx` (layout `<Outlet/>` neutre) + `codes-promo.index.tsx` (hub) + `codes-promo.$slug.tsx` (article, `notFound()` si slug inconnu).
- Composants : `PromoCodeCard`, `CopyCodeButton`, `BookmakerHero`, `BonusTable`, `PromoFaq`, `ResponsibleGamblingNotice`.
- Uniquement des tokens sémantiques du design system (brand/warn/surface) → thème sombre géré d'office.
- Aucune base de données, aucun appel API : 100 % statique.

## Hors scope

- Suivi de clics / statistiques d'affiliation (à ajouter plus tard si voulu, nécessite la base).
- Interface admin d'édition des codes.
