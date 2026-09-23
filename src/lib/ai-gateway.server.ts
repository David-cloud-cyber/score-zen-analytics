import { getConfig, getRuntimeEnv } from "./config.server";

/** Modèle unique utilisé par le bouton Analyse. Il reste côté serveur. */
export const AI_ANALYSIS_MODEL = "anthropic/claude-haiku-4.5" as const;

/** Modèles éditoriaux historiques : le bouton Analyse n'utilise pas ce routeur. */
export const AI_MODELS = {
  standard: "google/gemini-2.5-flash-lite",
  premium: "deepseek/deepseek-v3.2",
  fallback: "qwen/qwen3.7-flash",
} as const;

type MessageContent = string | Array<{ type?: string; text?: string }> | undefined;

type OpenRouterResponse = {
  choices?: Array<{
    message?: { content?: MessageContent };
  }>;
};

function contentToText(content: MessageContent): string {
  if (typeof content === "string") return content;
  return (content ?? [])
    .filter((part) => part?.type === "text" || part?.text)
    .map((part) => part.text ?? "")
    .join("\n");
}

function parseJsonText(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    // The deadline includes downloading the body, not only response headers.
    return { ok: response.ok, status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

export async function requestOpenRouterJson(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
  maxTokens?: number;
  providerOnly?: string[];
  allowProviderFallbacks?: boolean;
}): Promise<unknown> {
  const response = await fetchJsonWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.livefoot.fun",
        "X-Title": "LiveFoot",
      },
      body: JSON.stringify({
        model: params.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
        temperature: 0.15,
        max_tokens: params.maxTokens ?? 1600,
        ...(params.providerOnly || params.allowProviderFallbacks === false
          ? {
              provider: {
                ...(params.providerOnly ? { only: params.providerOnly } : {}),
                ...(params.allowProviderFallbacks === false ? { allow_fallbacks: false } : {}),
              },
            }
          : {}),
        ...(params.model.startsWith("deepseek/") ? { reasoning: { effort: "low" } } : {}),
      }),
    },
    params.timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}`);
  }

  const payload = JSON.parse(response.body) as OpenRouterResponse;
  const content = contentToText(payload.choices?.[0]?.message?.content);
  if (!content) throw new Error("OpenRouter a retourné une réponse vide.");
  return parseJsonText(content);
}

export async function requestGeminiJson(params: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
}): Promise<unknown> {
  const response = await fetchJsonWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(params.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: params.systemPrompt }] },
        contents: [{ parts: [{ text: params.userPrompt }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.15 },
      }),
    },
    params.timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`Gemini ${response.status}`);
  }

  const payload = JSON.parse(response.body) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n");
  if (!content) throw new Error("Le fournisseur IA a retourné une réponse vide.");
  return parseJsonText(content);
}

export function getOpenRouterModels() {
  return {
    standard: getRuntimeEnv("OPENROUTER_STANDARD_MODEL") || AI_MODELS.standard,
    premium: getRuntimeEnv("OPENROUTER_PREMIUM_MODEL") || AI_MODELS.premium,
    fallback: getRuntimeEnv("OPENROUTER_FALLBACK_MODEL") || AI_MODELS.fallback,
  };
}

/** Configuration stricte du modèle d'analyse : jamais de modèle ou provider de secours. */
export function getOpenRouterAnalysisModel() {
  return AI_ANALYSIS_MODEL;
}

export function getOpenRouterKey() {
  return getConfig("OPENROUTER_API_KEY");
}
