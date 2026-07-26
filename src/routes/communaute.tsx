import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, Send, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";

import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/communaute")({
  head: () =>
    buildRouteMeta({
      path: "/communaute",
      title: "Communauté & Échanges Live",
      description: "Discutez des matchs en direct, partagez vos pronostics de football et échangez vos tactiques.",
    }),
  component: CommunautePage,
});

function CommunautePage() {
  return (
    <AppShell>
      <PageTitle eyebrow="Communauté" title="Discussions live" />

      <div className="px-4 lg:px-0">
        <div className="relative overflow-hidden rounded-3xl bg-foreground p-6 text-background">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand/25 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full bg-data/25 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-background/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest">
              <Sparkles className="size-3" aria-hidden /> Bientôt disponible
            </div>
            <h2 className="text-xl font-black leading-tight lg:text-2xl">
              La communauté ScoreZen AI arrive
            </h2>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-background/70 lg:text-sm">
              Les fils de discussion par match et par compétition sont en cours de finalisation.
              Bientôt, vous pourrez partager vos pronostics, réagir aux actions live et débattre
              avec la communauté en temps réel.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-[11px] text-background/80">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden /> Fils par match & compétition
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-3.5" aria-hidden /> Réactions & pronostics
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-surface">
            <MessageCircle className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <h3 className="text-sm font-black">Aucune discussion pour l'instant</h3>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            Soyez notifié dès le lancement des discussions live. Laissez votre e-mail via le
            formulaire ci-dessous.
          </p>
          <NotifyForm />
        </div>
      </div>
    </AppShell>
  );
}

function NotifyForm() {
  const [email, setEmail] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!/.+@.+\..+/.test(email)) {
          toast.error("Adresse e-mail invalide.");
          return;
        }
        toast.success("Merci — nous vous préviendrons au lancement.");
        setEmail("");
      }}
      className="mx-auto mt-4 flex max-w-sm items-center gap-2 rounded-2xl bg-card p-2 ring-1 ring-black/5 dark:ring-white/5"
    >
      <label htmlFor="notify-email" className="sr-only">E-mail</label>
      <input
        id="notify-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="votre@email.com"
        className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-2 text-[11px] font-black text-background"
      >
        <Send className="size-3.5" aria-hidden /> Me prévenir
      </button>
    </form>
  );
}
