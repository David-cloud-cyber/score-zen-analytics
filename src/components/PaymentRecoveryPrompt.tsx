import { Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PaymentRecoveryAttempt } from "@/lib/payment-recovery";
import { formatXaf } from "@/lib/pricing";

export function PaymentRecoveryPrompt({
  attempt,
}: {
  attempt: PaymentRecoveryAttempt | null;
}) {
  const storageKey = attempt ? `livefoot:payment-recovery-dismissed:${attempt.id}` : "";
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(window.localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (!attempt || dismissed) return null;

  const dismiss = () => {
    window.localStorage.setItem(storageKey, "1");
    setDismissed(true);
  };

  return (
    <aside
      className="mx-4 mb-4 rounded-2xl border border-warn/35 bg-warn/10 p-3.5 shadow-sm lg:mx-0"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn">
          <CreditCard className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">Votre paiement n’a pas abouti</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Vous pouvez reprendre votre abonnement Premium en quelques secondes via la page de
            paiement sécurisée{attempt.amountXaf ? ` · ${formatXaf(attempt.amountXaf)}` : ""}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to="/premium"
              search={{ plan: attempt.kind === "subscription" ? "premium_monthly" : undefined }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand px-3.5 text-[11px] font-black text-brand-foreground transition-transform hover:-translate-y-0.5"
            >
              Réessayer le paiement <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-card px-3 text-[11px] font-black text-foreground hover:bg-surface"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer le rappel de paiement"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
