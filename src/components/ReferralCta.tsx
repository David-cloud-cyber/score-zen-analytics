import { Gift, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { requestReferralPopup } from "@/hooks/use-referral-popup";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { getMyReferralDetails } from "@/lib/referral.functions";

type ReferralCtaProps = {
  location: "sidebar" | "mobile_menu" | "analysis_result" | "home" | "daily_predictions" | "blog_article" | "premium_footer";
  variant?: "card" | "inline" | "icon";
  className?: string;
  showGuest?: boolean;
  showProgress?: boolean;
};

/**
 * Invitation volontaire, affichée après que l'utilisateur a déjà trouvé de la
 * valeur dans le produit. Le clic ouvre son lien unique, sans interruption
 * automatique ni ajout de données personnelles.
 */
export function ReferralCta({ location, variant = "card", className, showGuest = false, showProgress = false }: ReferralCtaProps) {
  const { user } = useSession();
  const details = useServerFn(getMyReferralDetails);
  const { data } = useQuery({
    queryKey: ["me", "referral", "cta"],
    queryFn: () => details(),
    enabled: Boolean(user) && showProgress,
    staleTime: 30_000,
  });

  useEffect(() => {
    track("referral_cta_view", { location, audience: user ? "member" : "guest" });
  }, [location, user]);

  useEffect(() => {
    if (showProgress && data) track("referral_milestone_progress_view", { location, remaining: data.remainingToNext });
  }, [data, location, showProgress]);

  if (!user) {
    if (!showGuest || variant === "icon") return null;
    return (
      <Link
        to="/auth"
        search={{ mode: "signup", source: "referral_campaign" }}
        onClick={() => track("referral_cta_click", { location, audience: "guest" })}
        className={cn("group block rounded-xl border border-brand/25 bg-brand/5 p-4 text-left transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand", className)}
      >
        <span className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground"><Users className="size-4" aria-hidden /></span>
          <span className="min-w-0"><span className="block text-sm font-black">Débloquez 7 jours Premium Pro <span className="text-brand">GRATUITS</span></span><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">25 amis confirmés. Créez votre compte pour commencer à inviter.</span><span className="mt-2 inline-flex text-[10px] font-black uppercase tracking-wider text-brand transition-transform group-hover:translate-x-0.5">Découvrir le programme →</span></span>
        </span>
      </Link>
    );
  }

  const open = () => {
    track("referral_cta_click", { location });
    requestReferralPopup();
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Inviter un ami et gagner 5 crédits"
        title="Inviter un ami · +5 crédits"
        className={cn(
          "grid size-10 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand transition-colors hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          className,
        )}
      >
        <Users className="size-4" aria-hidden />
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={open}
        className={cn(
          "flex w-full flex-col gap-3 rounded-xl border border-brand/25 bg-brand/5 p-4 text-left transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
        aria-label="Ouvrir le parrainage et débloquer Premium Pro"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground">
            <Gift className="size-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-black">7 jours Premium Pro <span className="text-brand">GRATUITS</span></span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{showProgress && data ? `Plus que ${data.remainingToNext} confirmation${data.remainingToNext > 1 ? "s" : ""} pour débloquer votre accès Pro.` : "25 amis confirmés = 7 jours Premium Pro offerts."}</span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand px-3.5 py-2 text-xs font-black text-brand-foreground">
          Inviter un ami
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "w-full rounded-xl border border-brand/25 bg-brand/10 p-3.5 text-left transition-colors hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand">
        <Gift className="size-2.5" aria-hidden /> Bonus parrainage
      </span>
      <span className="mt-2 flex items-center justify-between gap-2">
        <span>
          <span className="block text-[13px] font-black text-foreground">Débloquez Premium Pro <span className="text-brand">GRATUIT</span></span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            25 amis confirmés · +5 crédits par compte.
          </span>
        </span>
        <Users className="size-4 shrink-0 text-brand" aria-hidden />
      </span>
    </button>
  );
}
