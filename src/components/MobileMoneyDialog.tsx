import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileMoneyMedium = "mobile money" | "orange money";
export type PaymentDialogState = "idle" | "starting" | "waiting" | "success" | "failed";

export function MobileMoneyDialog({
  title,
  description,
  amountLabel,
  state,
  message,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  amountLabel: string;
  state: PaymentDialogState;
  message?: string;
  onClose: () => void;
  onConfirm: (input: { phone: string; medium: MobileMoneyMedium }) => Promise<void>;
}) {
  const [phone, setPhone] = useState("");
  const [medium, setMedium] = useState<MobileMoneyMedium>("mobile money");
  const canEdit = state === "idle" || state === "failed";
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^6\d{8}$/.test(phone)) return;
    await onConfirm({ phone, medium });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-t-3xl bg-background p-5 shadow-2xl ring-1 ring-border sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
              <Smartphone className="size-3" /> Paiement Mobile Money
            </div>
            <h2 className="text-xl font-black leading-tight">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-foreground ring-1 ring-border" aria-label="Fermer">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-surface p-3 text-center ring-1 ring-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Montant à confirmer</p>
          <p className="mt-1 text-2xl font-black text-foreground">{amountLabel}</p>
        </div>

        {(state === "waiting" || state === "success") && (
          <div className={cn("mt-4 rounded-2xl p-3 text-sm font-bold", state === "success" ? "bg-brand/10 text-brand" : "bg-warn/10 text-warn")} role="status">
            {state === "success" ? <CheckCircle2 className="mr-2 inline size-4" /> : <LoaderCircle className="mr-2 inline size-4 animate-spin" />}
            {message ?? (state === "success" ? "Paiement confirmé." : "Demande envoyée sur votre téléphone. Confirmez avec votre code Mobile Money.")}
          </div>
        )}

        {state === "failed" && (
          <div className="mt-4 rounded-2xl bg-alert/10 p-3 text-sm font-bold text-alert" role="alert">
            <AlertCircle className="mr-2 inline size-4" /> {message ?? "Le paiement n'a pas abouti. Vérifiez les informations et réessayez."}
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-xs font-black text-foreground">
            Opérateur
            <select value={medium} onChange={(event) => setMedium(event.target.value as MobileMoneyMedium)} disabled={!canEdit} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-brand disabled:opacity-60">
              <option value="mobile money">MTN Mobile Money</option>
              <option value="orange money">Orange Money</option>
            </select>
          </label>
          <label className="block text-xs font-black text-foreground">
            Numéro Mobile Money
            <div className="mt-1.5 flex h-11 items-center rounded-xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-brand">
              <span className="mr-2 text-sm font-bold text-muted-foreground">+237</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 9))} disabled={!canEdit} inputMode="numeric" autoComplete="tel" placeholder="6XXXXXXXX" className="min-w-0 flex-1 bg-transparent text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60" aria-label="Numéro Mobile Money" />
            </div>
            <span className="mt-1 block text-[10px] font-medium text-muted-foreground">Le numéro doit être celui du portefeuille à débiter.</span>
          </label>
          <button type="submit" disabled={!canEdit || phone.length !== 9} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-black text-brand-foreground transition-transform active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50">
            {state === "starting" ? <><LoaderCircle className="size-4 animate-spin" /> Préparation…</> : state === "waiting" ? "En attente de confirmation" : state === "success" ? "Paiement confirmé" : state === "failed" ? "Réessayer" : "Recevoir la demande sur mon téléphone"}
          </button>
        </form>
        <p className="mt-3 text-center text-[10px] font-medium text-muted-foreground">Ne communiquez jamais votre code secret ou votre code de confirmation.</p>
      </div>
    </div>
  );
}
