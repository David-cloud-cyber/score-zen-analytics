import { Link } from "@tanstack/react-router";
import { Check, Crown, X } from "lucide-react";
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import type { PremiumPromptStage } from "@/hooks/use-premium-prompt";

export function PremiumPrompt({ stage, onDismiss }: { stage: PremiumPromptStage; onDismiss: () => void }) {
  useEffect(() => {
    track("premium_prompt_shown", { stage });
  }, [stage]);

  function dismiss() {
    track("premium_prompt_dismissed", { stage });
    onDismiss();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/55 p-2 backdrop-blur-sm sm:place-items-center" onClick={dismiss} role="presentation">
      <div className="w-full max-w-[410px] rounded-2xl border border-brand/25 bg-background p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="premium-prompt-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand"><Crown className="size-3" /> LiveFoot Premium</span>
            <h2 id="premium-prompt-title" className="mt-3 text-xl font-black leading-tight">Passez Premium pour continuer vos analyses</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Gardez vos analyses disponibles avec 100 crédits chaque mois et un historique complet.</p>
          </div>
          <button type="button" onClick={dismiss} className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted-foreground hover:text-foreground" aria-label="Fermer"><X className="size-4" /></button>
        </div>
        <ul className="mt-4 space-y-2 text-xs font-bold"><li className="flex items-center gap-2"><Check className="size-3.5 text-brand" />100 crédits par mois</li><li className="flex items-center gap-2"><Check className="size-3.5 text-brand" />Environ 33 analyses</li><li className="flex items-center gap-2"><Check className="size-3.5 text-brand" />Historique, favoris et alertes</li></ul>
        <div className="mt-5 grid grid-cols-2 gap-2.5"><Link to="/premium" search={{}} onClick={() => track("premium_cta_click", { location: `premium_prompt_${stage}` })} className="inline-flex items-center justify-center rounded-xl bg-brand px-3 py-3 text-xs font-black text-brand-foreground">Voir les offres</Link><button type="button" onClick={dismiss} className="rounded-xl bg-surface px-3 py-3 text-xs font-bold text-foreground">Plus tard</button></div>
      </div>
    </div>
  );
}
