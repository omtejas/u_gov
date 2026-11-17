/**
 * Resolve a safe, deterministic Gemini model order.
 * A stale deployment variable must not pin production to a retired model.
 */
const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODELS = ["gemini-3.7-flash", "gemini-3.6-flash"];
const RETIRED_MODEL_IDS = new Set(["gemini-2.5-flash"]);

export function getGeminiModelCandidates(configuredModel?: string): string[] {
  const configured = (configuredModel || "").trim().replace(/^models\//, "");
  const candidates = [PRIMARY_MODEL];

  if (
    configured &&
    configured !== PRIMARY_MODEL &&
    !RETIRED_MODEL_IDS.has(configured) &&
    /^[a-z0-9][a-z0-9.-]{1,80}$/i.test(configured)
  ) {
    candidates.push(configured);
  }

  candidates.push(...FALLBACK_MODELS);
  return [...new Set(candidates)];
}

/** Retry another model only when the failure can plausibly be model-specific. */
export function shouldTryNextGeminiModel(error: unknown): boolean {
  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown; message?: unknown };
  const status = Number(candidate?.status || candidate?.statusCode || candidate?.code);
  if (status === 401 || status === 403 || status === 429) return false;
  const message = String(candidate?.message || error || "").toLowerCase();
  if (/\b(401|403|429)\b|unauthorized|permission denied|api key|quota|rate.?limit/.test(message)) {
    return false;
  }
  return true;
}
