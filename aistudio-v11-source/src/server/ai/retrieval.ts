/**
 * U-AI — Tokenization, Whole-Word Matching & Measurable Relevance Scoring
 *
 * Replaces naive substring matching (.includes) with stopword-filtered,
 * word-boundary tokenization, controlled morphological variants, and
 * explicit minimum relevance thresholds.
 */

export const MIN_FAQ_RELEVANCE_SCORE = 5;
export const MIN_SERVICE_RELEVANCE_SCORE = 5;
export const MIN_KNOWLEDGE_RELEVANCE_SCORE = 4;

const STOPWORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "between", "by", "can", "could",
  "did", "difference", "do", "does", "elaborate", "explain", "find", "for", "from", "get",
  "give", "has", "have", "help", "how", "i", "in", "info", "information", "is", "it",
  "its", "me", "more", "my", "need", "of", "on", "or", "our", "please", "same", "show",
  "tell", "that", "the", "their", "them", "there", "these", "they", "this", "to", "us",
  "use", "used", "using", "vs", "want", "was", "we", "what", "when", "where", "which",
  "who", "why", "will", "with", "would", "you", "your",
]);

// High-frequency structural civic/platform terms that must not dominate retrieval on their own
// when a more specific topic token (e.g., "ration", "ai", "developer") is present.
export const GENERIC_DOMAIN_TOKENS = new Set([
  "apply", "application", "applications", "card", "cards", "certificate", "certificates",
  "check", "citizen", "citizens", "document", "documents", "eligibility", "eligible",
  "gov", "government", "guide", "india", "indian", "national", "portal", "process",
  "renew", "renewal", "require", "required", "requirements", "scheme", "schemes",
  "service", "services", "state", "status", "system", "ugov", "u-gov",
]);

// Short high-signal domain acronyms preserved during tokenization (matched only as whole words)
const SHORT_DOMAIN_TOKENS = new Set([
  "ai", "ui", "ux", "db", "dl", "id", "ip", "it", "ml", "rc", "s3", "pg",
]);

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches a token/phrase on non-alphanumeric word boundaries so short tokens
 * like "hi", "ai", "use", or "ration" never match inside unrelated words
 * such as "Higher", "available", "household", or "integration".
 */
export function hasWholeWordMatch(haystack: string, phraseOrToken: string): boolean {
  const needle = phraseOrToken.trim().toLowerCase();
  if (!needle) return false;
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(needle)}(?:$|[^a-z0-9])`, "i");
  return pattern.test(haystack);
}

/**
 * Returns normalized whole-word lookup variants (singular/plural + common US/UK spelling)
 * without loosening word boundaries.
 */
export function getTokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  if (token === "licence") variants.add("license");
  if (token === "license") variants.add("licence");
  if (token === "licences") {
    variants.add("licence");
    variants.add("license");
    variants.add("licenses");
  }
  if (token === "licenses") {
    variants.add("license");
    variants.add("licence");
    variants.add("licences");
  }
  if (token.length > 4 && token.endsWith("ies")) {
    variants.add(`${token.slice(0, -3)}y`);
  } else if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
    variants.add(token.slice(0, -1));
  }
  return Array.from(variants);
}

/**
 * Extracts normalized, stopword-free search tokens while preserving hyphenated
 * platform/scheme identifiers (e.g. "u-gov", "g-bot", "pm-kisan").
 */
export function tokenizeSearchQuery(query: string): string[] {
  const clean = query.toLowerCase().trim();
  if (!clean) return [];

  const rawChunks = clean.split(/[^a-z0-9-]+/).filter(Boolean);
  const tokens: string[] = [];
  const seen = new Set<string>();

  const pushToken = (tok: string) => {
    if (!tok || seen.has(tok) || STOPWORDS.has(tok)) return;
    if (tok.length >= 3 || SHORT_DOMAIN_TOKENS.has(tok)) {
      seen.add(tok);
      tokens.push(tok);
    }
  };

  for (const chunk of rawChunks) {
    if (chunk.includes("-")) {
      const joined = chunk.replace(/-/g, "");
      if (chunk.length >= 3 && !STOPWORDS.has(chunk)) {
        pushToken(chunk);
        if (joined !== chunk && joined.length >= 3) pushToken(joined);
      }
      for (const part of chunk.split("-").filter(Boolean)) {
        if (part.length >= 3 || SHORT_DOMAIN_TOKENS.has(part)) {
          pushToken(part);
        }
      }
    } else {
      pushToken(chunk);
    }
  }

  return tokens;
}

export interface WeightedField {
  text: string;
  weight: number;
}

export interface ScoredMatch {
  rawScore: number;
  matchedTerms: string[];
  specificMatchedTerms: string[];
  titleMatched: boolean;
}

/**
 * Computes measurable whole-word relevance across weighted text fields.
 * Never awards points for accidental substring overlap inside longer words.
 * Prevents generic terms ("document", "card", "required", "services") from
 * producing false positives when a specific topic token did not match at all.
 */
export function scoreWeightedFields(
  query: string,
  tokens: string[],
  primaryTitle: string,
  fields: WeightedField[],
  exactAliases: string[] = []
): ScoredMatch {
  const cleanQuery = query.toLowerCase().trim();
  let rawScore = 0;
  const matchedTerms: string[] = [];
  const specificMatchedTerms: string[] = [];
  let titleMatched = false;

  const specificQueryTokens = tokens.filter((t) => !GENERIC_DOMAIN_TOKENS.has(t));

  // 1. Exact phrase / alias match on word boundaries
  for (const alias of [primaryTitle, ...exactAliases]) {
    const cleanAlias = alias.toLowerCase().trim();
    if (!cleanAlias || cleanAlias.length < 2) continue;
    if (cleanQuery === cleanAlias) {
      rawScore += 12;
      titleMatched = true;
      if (!matchedTerms.includes(cleanAlias)) matchedTerms.push(cleanAlias);
      if (!GENERIC_DOMAIN_TOKENS.has(cleanAlias) && !specificMatchedTerms.includes(cleanAlias)) {
        specificMatchedTerms.push(cleanAlias);
      }
    } else if (cleanAlias.length >= 3 && hasWholeWordMatch(cleanQuery, cleanAlias)) {
      rawScore += 8;
      titleMatched = true;
      if (!matchedTerms.includes(cleanAlias)) matchedTerms.push(cleanAlias);
      if (!GENERIC_DOMAIN_TOKENS.has(cleanAlias) && !specificMatchedTerms.includes(cleanAlias)) {
        specificMatchedTerms.push(cleanAlias);
      }
    }
  }

  // 2. Per-token whole-word scoring across weighted fields
  for (const token of tokens) {
    const isGeneric = GENERIC_DOMAIN_TOKENS.has(token);
    const variants = getTokenVariants(token);
    let bestTokenWeight = 0;

    for (const field of fields) {
      if (!field.text) continue;
      const matched = variants.some((v) => hasWholeWordMatch(field.text, v));
      if (matched) {
        const effectiveWeight = isGeneric ? Math.min(1, field.weight) : field.weight;
        if (effectiveWeight > bestTokenWeight) {
          bestTokenWeight = effectiveWeight;
        }
        if (field.weight >= 4 && !isGeneric) {
          titleMatched = true;
        }
      }
    }

    if (bestTokenWeight > 0) {
      rawScore += bestTokenWeight;
      if (!matchedTerms.includes(token)) {
        matchedTerms.push(token);
      }
      if (!isGeneric && !specificMatchedTerms.includes(token)) {
        specificMatchedTerms.push(token);
      }
    }
  }

  // Noise suppression guard: if the user named specific non-generic topics (e.g., "ration", "ai", "developer"),
  // and ZERO specific topic tokens (or aliases) matched, demote rawScore below any threshold.
  if (specificQueryTokens.length > 0 && specificMatchedTerms.length === 0) {
    rawScore = Math.min(rawScore, 1);
  }

  return {
    rawScore,
    matchedTerms,
    specificMatchedTerms,
    titleMatched,
  };
}
