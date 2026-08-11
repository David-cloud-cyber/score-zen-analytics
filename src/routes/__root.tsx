import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SessionProvider } from "@/hooks/use-session";
import { CookieBanner } from "@/components/CookieBanner";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/hooks/use-theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("Root Error Boundary caught:", error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Cette page n'a pas pu être chargée.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur s'est produite de notre côté. Vous pouvez essayer d'actualiser la page ou
          retourner à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2.5 text-xs font-bold text-background transition-transform active:scale-95"
          >
            Essayer à nouveau
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-transform active:scale-95"
          >
            Rentrez chez vous
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#10b981" },
      { title: "Scores football en direct et analyses — LiveFoot IA" },
      {
        name: "description",
        content:
          "Scores football en direct, matchs du jour et analyses IA : probabilités, compositions, forme récente et facteurs clés pour chaque rencontre.",
      },
      { property: "og:site_name", content: "LiveFoot IA" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.livefoot.fun" },
      { property: "og:locale", content: "fr_FR" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Scores football en direct et analyses — LiveFoot IA" },
      {
        name: "twitter:title",
        content: "Scores football en direct et analyses — LiveFoot IA",
      },
      {
        property: "og:description",
        content:
          "Scores football en direct, matchs du jour et analyses IA : probabilités, compositions, forme récente et facteurs clés pour chaque rencontre.",
      },
      {
        name: "twitter:description",
        content:
          "Scores football en direct, matchs du jour et analyses IA : probabilités, compositions, forme récente et facteurs clés pour chaque rencontre.",
      },
      { property: "og:image", content: "https://www.livefoot.fun/logo.png" },
      { property: "og:image:alt", content: "Logo LiveFoot AI" },
      { name: "twitter:image", content: "https://www.livefoot.fun/logo.png" },
      { name: "twitter:image:alt", content: "Logo LiveFoot AI" },
      // AEO/GEO — informations d'éditeur exploitées par les moteurs de réponse et les IA
      { name: "author", content: "LiveFoot AI" },
      { name: "publisher", content: "LiveFoot AI" },
      { httpEquiv: "content-language", content: "fr" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://media.api-sports.io", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap",
      },
    ],
    scripts: [
      { children: THEME_INIT_SCRIPT },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "LiveFoot IA",
          url: "https://www.livefoot.fun",
          logo: "https://www.livefoot.fun/logo.png",
          description:
            "Scores en direct et analyses IA détaillées sur chaque match de football : probabilités, marchés, compositions et prédictions.",
          knowsAbout: [
            "Livescore football",
            "Prédictions football par intelligence artificielle",
            "Analyse statistique de matchs",
            "Codes promo bookmakers en Afrique francophone",
            "Paris sportifs en FCFA",
          ],
          areaServed: ["CM", "CI", "SN", "BF", "ML", "TG", "BJ", "CD", "FR"],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "LiveFoot IA",
          url: "https://www.livefoot.fun",
          description: "Livescore et analyses IA football en temps réel.",
          inLanguage: "fr",
          publisher: {
            "@type": "Organization",
            name: "LiveFoot IA",
            url: "https://www.livefoot.fun",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
          router.invalidate();
        }
      });
      return () => data.subscription.unsubscribe();
    });
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <Outlet />
          <CookieBanner />
          <Toaster position="top-center" richColors />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
