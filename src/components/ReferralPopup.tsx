/**
 * ReferralPopup — bottom sheet (mobile) / modal centré (desktop)
 *
 * Variantes :
 *   "free_invite"         → Parrainage + bouton Premium (free users)
 *   "premium_low_credits" → Recharger crédits + Abonnement Annuel (premium users)
 */
import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { X, Users, Crown, Coins, Copy, Check, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { type PopupVariant } from "@/hooks/use-referral-popup";
import { getMyReferralCode } from "@/lib/referral.functions";

const BASE_URL = "https://www.livefoot.fun";

interface ReferralPopupProps {
  variant: PopupVariant;
  onDismiss: () => void;
}

export function ReferralPopup({ variant, onDismiss }: ReferralPopupProps) {
  if (!variant) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-foreground/60 backdrop-blur-sm sm:place-items-center"
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl sm:max-w-sm"
      >
        {variant === "free_invite" && <FreeInviteContent onDismiss={onDismiss} />}
        {variant === "premium_low_credits" && <PremiumLowCreditsContent onDismiss={onDismiss} />}
      </div>
    </div>
  );
}

/* ── Variante Free : invitation + upsell Premium ───────────────────────────── */

function FreeInviteContent({ onDismiss }: { onDismiss: () => void }) {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const fetchCode = useServerFn(getMyReferralCode);

  useEffect(() => {
    fetchCode()
      .then((res) => setReferralCode(res.code))
      .catch(() => setReferralCode(null))
      .finally(() => setLoading(false));
  }, [fetchCode]);

  const referralLink = referralCode ? `${BASE_URL}/auth?ref=${referralCode}` : null;

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard
      .writeText(referralLink)
      .then(() => {
        setCopied(true);
        toast.success("Lien copié !");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Impossible de copier."));
  };

  const handleWhatsApp = () => {
    if (!referralLink) return;
    const text = encodeURIComponent(
      `🔥 Rejoins-moi sur Livefoot IA — analyses football IA en temps réel !\nInscris-toi avec mon lien et on joue ensemble 👉 ${referralLink}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
            <Users className="size-3" /> Parrainage
          </div>
          <h2 className="text-xl font-black leading-tight">
            Invitez un ami,<br />gagnez 5 crédits
          </h2>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Partagez votre lien. Dès que votre ami s'inscrit, vous recevez automatiquement{" "}
            <span className="font-bold text-brand">+5 crédits</span>.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-black/5 dark:ring-white/10"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Referral link */}
      <div className="mt-4">
        {loading ? (
          <div className="h-11 animate-pulse rounded-2xl bg-surface" />
        ) : referralLink ? (
          <div className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-black/5 dark:ring-white/10">
            <span className="min-w-0 flex-1 truncate text-[11px] font-mono text-muted-foreground">
              {referralLink}
            </span>
            <button
              onClick={handleCopy}
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-xl transition-colors",
                copied ? "bg-brand text-brand-foreground" : "bg-foreground text-background",
              )}
              aria-label="Copier"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        ) : null}
      </div>

      {/* CTA buttons */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          onClick={handleWhatsApp}
          disabled={!referralLink}
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#25D366] py-3 text-xs font-black text-white transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          <WhatsAppIcon /> Partager
        </button>
        <Link
          to="/premium"
          onClick={onDismiss}
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-foreground py-3 text-xs font-black text-background transition-transform active:scale-[0.98]"
        >
          <Crown className="size-3.5 text-warn" /> Premium
        </Link>
      </div>

      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        Votre ami reçoit ses 10 crédits de bienvenue habituels. Vous, +5 crédits.
      </p>
    </>
  );
}

/* ── Variante Premium : crédits épuisés ─────────────────────────────────────── */

function PremiumLowCreditsContent({ onDismiss }: { onDismiss: () => void }) {
  const navigate = useNavigate();

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-warn">
            <Coins className="size-3" /> Crédits faibles
          </div>
          <h2 className="text-xl font-black leading-tight">
            Vos crédits<br />s'épuisent
          </h2>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Continuez vos analyses sans interruption — rechargez maintenant ou
            passez à l'abonnement annuel (2 mois offerts).
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-black/5 dark:ring-white/10"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Stats rapides */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-warn/10 p-3 ring-1 ring-warn/20">
          <div className="flex items-center gap-1 text-warn">
            <Zap className="size-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Packs crédits</span>
          </div>
          <div className="mt-1 text-xs font-bold leading-snug text-foreground">
            De 15 à 280 crédits<br />
            <span className="text-muted-foreground font-normal">À partir de 1 700 FCFA</span>
          </div>
        </div>
        <div className="rounded-2xl bg-brand/10 p-3 ring-1 ring-brand/20">
          <div className="flex items-center gap-1 text-brand">
            <Sparkles className="size-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Annuel</span>
          </div>
          <div className="mt-1 text-xs font-bold leading-snug text-foreground">
            2 mois offerts<br />
            <span className="text-muted-foreground font-normal">49 000 FCFA/an</span>
          </div>
        </div>
      </div>

      {/* CTA buttons */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          onClick={() => {
            onDismiss();
            navigate({ to: "/profil" });
          }}
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-warn py-3 text-xs font-black text-neutral-900 transition-transform active:scale-[0.98]"
        >
          <Coins className="size-3.5" /> Recharger
        </button>
        <Link
          to="/premium"
          onClick={onDismiss}
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-foreground py-3 text-xs font-black text-background transition-transform active:scale-[0.98]"
        >
          <Crown className="size-3.5 text-warn" /> Annuel
        </Link>
      </div>
    </>
  );
}

/* ── Icône WhatsApp ─────────────────────────────────────────────────────────── */
function WhatsAppIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.112.553 4.094 1.518 5.814L0 24l6.335-1.652A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.812 9.812 0 0 1-5.012-1.374l-.36-.214-3.732.975.999-3.647-.235-.374A9.817 9.817 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
    </svg>
  );
}
