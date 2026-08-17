import { useCallback, useEffect, useState } from "react";

export type PremiumPromptStage = "first_analysis" | "low_credits";

export const PREMIUM_PROMPT_EVENT = "livefoot:open-premium-prompt";
const STORAGE_PREFIX = "livefoot-premium-prompt-v1";

function storageKey(userId: string, stage: PremiumPromptStage) {
  return `${STORAGE_PREFIX}:${userId}:${stage}`;
}

export function requestPremiumPrompt(stage: PremiumPromptStage) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PremiumPromptStage>(PREMIUM_PROMPT_EVENT, { detail: stage }));
}

export function resetPremiumPrompt(stage: PremiumPromptStage, userId?: string) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.removeItem(storageKey(userId, stage));
  } catch {
    // Le stockage local peut être indisponible en mode privé.
  }
}

function wasShown(userId: string, stage: PremiumPromptStage) {
  try {
    return window.localStorage.getItem(storageKey(userId, stage)) === "1";
  } catch {
    return false;
  }
}

function markShown(userId: string, stage: PremiumPromptStage) {
  try {
    window.localStorage.setItem(storageKey(userId, stage), "1");
  } catch {
    // Une session sans stockage reste fonctionnelle.
  }
}

export function usePremiumPrompt(userId?: string) {
  const [stage, setStage] = useState<PremiumPromptStage | null>(null);

  const dismiss = useCallback(() => setStage(null), []);

  useEffect(() => {
    const handleRequest = (event: Event) => {
      if (!userId) return;
      const nextStage = (event as CustomEvent<PremiumPromptStage>).detail;
      if (nextStage !== "first_analysis" && nextStage !== "low_credits") return;
      if (wasShown(userId, nextStage)) return;
      markShown(userId, nextStage);
      setStage(nextStage);
    };

    window.addEventListener(PREMIUM_PROMPT_EVENT, handleRequest);
    return () => window.removeEventListener(PREMIUM_PROMPT_EVENT, handleRequest);
  }, [userId]);

  useEffect(() => {
    if (!userId) setStage(null);
  }, [userId]);

  return { stage, dismiss };
}
