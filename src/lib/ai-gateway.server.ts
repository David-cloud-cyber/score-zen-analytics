import { getConfig, getRuntimeEnv } from "./config.server";

/** Modèles internes : leurs noms ne sont jamais renvoyés à l'utilisateur. */
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
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
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
        ...(params.model.startsWith("deepseek/") ? { reasoning: { enabled: true } } : {}),
      }),
    },
    params.timeoutMs,
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 180)}`);
  }

  const payload = (await response.json()) as OpenRouterResponse;
  const content = contentToText(payload.choices?.[0]?.message?.content);
  if (!content) throw new Error("OpenRouter a retourné une réponse vide.");
  return parseJsonText(content);
}

export function getOpenRouterModels() {
  return {
    standard: getRuntimeEnv("OPENROUTER_STANDARD_MODEL") || AI_MODELS.standard,
    premium: getRuntimeEnv("OPENROUTER_PREMIUM_MODEL") || AI_MODELS.premium,
    fallback: getRuntimeEnv("OPENROUTER_FALLBACK_MODEL") || AI_MODELS.fallback,
  };
}

export function getOpenRouterKey() {
  return getConfig("OPENROUTER_API_KEY");
}
