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
