import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, Smartphone, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getRelayitCheckoutOptions } from "@/lib/payments.functions";
import type { RelayitCheckoutDetails, RelayitCountryOption, RelayitNetworkOption } from "@/lib/relayit.server";

type Props = {
  open: boolean;
  busy: boolean;
  initialPhone?: string;
  onClose: () => void;
  onSubmit: (details: RelayitCheckoutDetails) => void | Promise<void>;
};

export function RelayitCheckoutDialog({ open, busy, initialPhone = "", onClose, onSubmit }: Props) {
  const loadOptions = useServerFn(getRelayitCheckoutOptions);
  const [countries, setCountries] = useState<RelayitCountryOption[]>([]);
  const [networks, setNetworks] = useState<RelayitNetworkOption[]>([]);
  const [countryCode, setCountryCode] = useState("");
  const [networkCode, setNetworkCode] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingNetworks, setLoadingNetworks] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhone(initialPhone);
    setError("");
    setLoadingCountries(true);
    void loadOptions({ data: {} }).then(async (result) => {
      if (cancelled) return;
      setCountries(result.countries);
      const preferred = result.countries.find((country) => country.code === "CM") ?? result.countries[0];
      if (!preferred) {
        setError("Aucun pays en FCFA n’est actuellement proposé par Relayit.");
        return;
      }
      setCountryCode(preferred.code);
      setLoadingNetworks(true);
      const networkResult = await loadOptions({ data: { countryCode: preferred.code } });
      if (cancelled) return;
      setNetworks(networkResult.networks);
      setNetworkCode(networkResult.networks[0]?.code ?? "");
      if (!networkResult.networks.length) setError("Aucun réseau disponible pour ce pays.");
    }).catch(() => {
      if (!cancelled) setError("Les moyens de paiement sont momentanément indisponibles. Réessayez.");
    }).finally(() => {
      if (!cancelled) {
        setLoadingCountries(false);
        setLoadingNetworks(false);
      }
    });
    return () => { cancelled = true; };
  }, [initialPhone, loadOptions, open]);

  if (!open) return null;
  const selectedCountry = countries.find((country) => country.code === countryCode);

  const changeCountry = async (code: string) => {
    const country = countries.find((item) => item.code === code);
    setCountryCode(code);
    setNetworkCode("");
    setNetworks([]);
    setError("");
    if (!country) return;
    setLoadingNetworks(true);
    try {
      const result = await loadOptions({ data: { countryCode: country.code } });
      setNetworks(result.networks);
      setNetworkCode(result.networks[0]?.code ?? "");
      if (!result.networks.length) setError("Aucun réseau disponible pour ce pays.");
    } catch {
      setError("Impossible de charger les réseaux de ce pays. Réessayez.");
    } finally {
      setLoadingNetworks(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPhone = phone.replace(/[\s()-]/g, "");
    if (!/^\+[1-9][0-9]{7,14}$/.test(normalizedPhone)) {
      setError("Saisissez le numéro au format international, par exemple +2376XXXXXXXX.");
      return;
    }
    if (!selectedCountry || !networkCode) {
      setError("Choisissez le pays et le réseau utilisés pour le paiement.");
      return;
    }
    setError("");
    void onSubmit({ country: selectedCountry.code, currency: selectedCountry.currency, network: networkCode, phone: normalizedPhone });
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-black/65 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="relayit-checkout-title" className="w-full max-w-md rounded-t-2xl bg-background p-5 text-foreground shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand"><Smartphone className="size-4" /> Paiement sécurisé Relayit</div>
            <h2 id="relayit-checkout-title" className="text-xl font-bold">Confirmer les informations Mobile Money</h2>
            <p className="mt-2 text-sm text-muted-foreground">Votre numéro et ces informations sont transmis à Relayit pour préparer le paiement. Vous le confirmez ensuite sur sa page sécurisée.</p>
          </div>
          <button type="button" aria-label="Fermer" disabled={busy} onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-foreground ring-1 ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"><X className="size-4" /></button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">
            Pays
            <select required value={countryCode} onChange={(event) => void changeCountry(event.target.value)} disabled={loadingCountries || busy || !countries.length} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name} · {country.currency}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Réseau Mobile Money
            <select required value={networkCode} onChange={(event) => setNetworkCode(event.target.value)} disabled={loadingNetworks || busy || !networks.length} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              {networks.map((network) => <option key={network.code} value={network.code}>{network.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Numéro Mobile Money
            <input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+237 6XX XXX XXX" disabled={busy} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" />
          </label>
          <p className="text-xs text-muted-foreground">Des frais Relayit peuvent s’ajouter au montant et seront affichés avant votre confirmation de paiement.</p>
          {error && <p role="alert" className="rounded-xl bg-alert/10 p-3 text-sm font-medium text-alert">{error}</p>}
          <button type="submit" disabled={busy || loadingCountries || loadingNetworks || !networkCode} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-base font-semibold text-brand-foreground transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
            {busy ? <><LoaderCircle className="size-4 animate-spin" /> Ouverture du paiement…</> : <>{loadingCountries || loadingNetworks ? "Chargement des moyens…" : "Continuer vers Relayit"}<ArrowRight className="size-4" /></>}
          </button>
        </form>
      </section>
    </div>
  );
}
