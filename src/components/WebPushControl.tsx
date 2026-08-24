import { BellRing, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getWebPushState, removeWebPushSubscription, saveWebPushSubscription } from "@/lib/push-marketing.functions";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function deviceFamily(): "mobile" | "tablet" | "desktop" {
  const width = window.innerWidth;
  return width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

export function WebPushControl() {
  const getState = useServerFn(getWebPushState);
  const save = useServerFn(saveWebPushSubscription);
  const remove = useServerFn(removeWebPushSubscription);
  const [state, setState] = useState<"unsupported" | "loading" | "available" | "active" | "denied">("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    void getState().then(async (result) => {
      setPublicKey(result.publicKey);
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      setState(subscription || result.subscribed ? "active" : "available");
    }).catch(() => setState("unsupported"));
  }, [getState]);

  async function activate() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "available");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("subscription_incomplete");
      await save({ data: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, deviceFamily: deviceFamily() } });
      setState("active");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await remove({ data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setState("available");
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported" || state === "loading") return null;
  if (state === "denied") return <p className="rounded-xl bg-surface px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">Les alertes sont désactivées dans ce navigateur. Vous pouvez les réactiver depuis ses réglages.</p>;
  return <button type="button" onClick={() => void (state === "active" ? deactivate() : activate())} disabled={busy || !publicKey} className="flex w-full items-center gap-3 rounded-xl bg-surface px-3 py-2.5 text-left text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60">
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">{busy ? <Loader2 className="size-4 animate-spin" /> : state === "active" ? <Check className="size-4" /> : <BellRing className="size-4" />}</span>
    <span className="min-w-0"><strong className="block text-xs">{state === "active" ? "Alertes actives sur cet appareil" : "Recevoir les alertes sur cet appareil"}</strong><span className="mt-0.5 block text-[10px] text-muted-foreground">{state === "active" ? "Touchez pour les désactiver." : "Matchs importants et nouveautés, sans surcharge."}</span></span>
  </button>;
}

