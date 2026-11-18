/**
 * U-AI — Secure Citizen Assistance & Intelligence API Routes
 *
 * Endpoints for Bharat G-Bot sovereign AI assistant, grounded in U-SERVICES
 * and governed by authenticated citizen authorization and U-AUDIT logging.
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { AuthenticatedRequest, requireAuth, rateLimiter, csrfProtection } from "../middleware/auth";
import { aiFactory } from "../ai";
import { getGeminiModelCandidates } from "../ai/geminiModelConfig";
import { lookupGlossaryTerm } from "../ai/localKnowledge";
import { GeminiProvider, GeminiProbeResult } from "../ai/GeminiProvider";
import { db } from "../database/db";

export const aiRouter = Router();

interface AIRuntimeTelemetry {
  totalRequests: number;
  totalFallbacks: number;
  totalOfflineFallbacks: number;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastSuccessModel: string | null;
  lastFailureAt: string | null;
  lastErrorCategory: string | null;
  lastLatencyMs: number | null;
}

const runtimeTelemetry: AIRuntimeTelemetry = {
  totalRequests: 0,
  totalFallbacks: 0,
  totalOfflineFallbacks: 0,
  consecutiveFailures: 0,
  lastSuccessAt: null,
  lastSuccessModel: null,
  lastFailureAt: null,
  lastErrorCategory: null,
  lastLatencyMs: null,
};

// Apply sliding-window rate limiter to AI endpoints (max 30 queries per minute per IP)
aiRouter.use(rateLimiter(60000, 30));

/**
 * GET /api/v1/ai/health
 * Public telemetry for AI service readiness.
 * Supports ?probe=live to execute an authenticated server-side generation probe.
 */
aiRouter.get("/health", async (req: Request, res: Response) => {
  const provider = aiFactory.getAIProvider();
  const isLiveAI = provider.providerName === "GeminiProvider" || provider.providerName === "OpenAIProvider";
  const searchConfigured = Boolean(process.env.TAVILY_API_KEY || process.env.BRAVE_SEARCH_API_KEY);
  const configuredModels =
    provider.providerName === "GeminiProvider"
      ? getGeminiModelCandidates(process.env.GEMINI_MODEL)
      : provider.providerName === "OpenAIProvider"
        ? [process.env.OPENAI_MODEL || "gpt-4.1-mini"]
        : ["deterministic-local-catalogue"];

  let probeResult: GeminiProbeResult | undefined;
  const shouldProbeLive = String(req.query.probe || "").toLowerCase() === "live";

  if (shouldProbeLive && provider instanceof GeminiProvider) {
    probeResult = await provider.probeHealth();
    const nowIso = new Date().toISOString();
    runtimeTelemetry.lastLatencyMs = probeResult.latencyMs;
    if (probeResult.verified) {
      runtimeTelemetry.lastSuccessAt = nowIso;
      runtimeTelemetry.lastSuccessModel = probeResult.model || configuredModels[0];
      runtimeTelemetry.consecutiveFailures = 0;
    } else {
      runtimeTelemetry.lastFailureAt = nowIso;
      runtimeTelemetry.lastErrorCategory = probeResult.errorCategory || "provider_error";
      runtimeTelemetry.consecutiveFailures += 1;
    }
  }

  let providerStatus: string = "DETERMINISTIC_DEMO";
  if (isLiveAI) {
    if (probeResult) {
      providerStatus = probeResult.verified ? "VERIFIED_LIVE" : "OFFLINE_FALLBACK";
    } else if (runtimeTelemetry.consecutiveFailures > 0) {
      providerStatus = "OFFLINE_FALLBACK";
    } else if (runtimeTelemetry.lastSuccessAt && runtimeTelemetry.totalFallbacks > 0) {
      providerStatus = "RESPONDING_WITH_FALLBACK";
    } else if (runtimeTelemetry.lastSuccessAt) {
      providerStatus = "RESPONDING";
    } else {
      providerStatus = "CONFIGURED_NOT_PROBED";
    }
  }

  const healthNotice = !isLiveAI
    ? "No hosted AI key is configured. Responses use the deterministic U-GOV demo provider."
    : providerStatus === "VERIFIED_LIVE"
      ? `Live Gemini probe succeeded (${probeResult?.model || runtimeTelemetry.lastSuccessModel}, ${probeResult?.latencyMs}ms).`
      : providerStatus === "OFFLINE_FALLBACK"
        ? `Hosted AI unavailable (${runtimeTelemetry.lastErrorCategory || "upstream_error"}); Bharat G-Bot automatically falls back to verified U-GOV local knowledge.`
        : providerStatus === "RESPONDING" || providerStatus === "RESPONDING_WITH_FALLBACK"
          ? `Hosted AI responding via ${runtimeTelemetry.lastSuccessModel || configuredModels[0]}.`
          : "A hosted AI provider is configured. Pass ?probe=live or send a chat query to verify live generation.";

  return res.json({
    status: "HEALTHY",
    provider: provider.providerName,
    providerLabel:
      provider.providerName === "OpenAIProvider"
        ? process.env.OPENAI_MODEL || "OpenAI-compatible model"
        : provider.providerName === "GeminiProvider"
          ? configuredModels[0]
          : "U-GOV deterministic demo assistant",
    configuredModels,
    externalProviderConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY),
    providerConfigured: isLiveAI && Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY),
    providerStatus,
    internetSearchConfigured: searchConfigured,
    mode: isLiveAI ? "LIVE_AI" : "DETERMINISTIC_DEMO",
    liveAI: isLiveAI,
    probeResult,
    runtimeTelemetry: { ...runtimeTelemetry },
    notice: healthNotice,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/v1/ai/chat
 * Authenticated sovereign citizen AI assistant
 */
aiRouter.post("/chat", requireAuth, csrfProtection, async (req: AuthenticatedRequest, res: Response) => {
  const correlationId = crypto.randomUUID();
  const routeStart = Date.now();
  try {
    const { message, language = "en", conversationHistory = [] } = req.body || {};

    // 1. Strict Input Validation
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required and must be a non-empty string.",
      });
    }

    const cleanMessage = message.trim();
    if (cleanMessage.length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Message exceeds maximum allowed length of 1000 characters.",
      });
    }

    // Validate conversation history format
    let validHistory: Array<{ role: "user" | "model"; text: string }> = [];
    if (Array.isArray(conversationHistory)) {
      if (conversationHistory.length > 20) {
        return res.status(400).json({
          success: false,
          error: "Conversation history exceeds maximum allowed limit of 20 messages.",
        });
      }

      validHistory = conversationHistory
        .filter((h) => h && typeof h.text === "string" && (h.role === "user" || h.role === "model"))
        .map((h) => ({
          role: h.role,
          text: h.text.slice(0, 500),
        }));
    }

    const citizen = req.user!;
    const profile = req.profile;

    // 2. Audit Query Submission
    try {
      db.insertAuditEvent({
        actorId: citizen.id,
        actorName: profile?.displayName || citizen.identifier,
        actorRole: "CITIZEN",
        action: "AI_QUERY_SUBMITTED",
        resource: "U_AI:CHAT",
        result: "SUCCESS",
        context: JSON.stringify({
          correlationId,
          queryLength: cleanMessage.length,
          language: typeof language === "string" ? language.slice(0, 10) : "en",
          historyLength: validHistory.length,
        }),
        ipAddress: req.ip,
      });
    } catch {
      // Non-blocking audit error
    }

    // 3. Resolve Provider & Tool Gateway
    const provider = aiFactory.getAIProvider();
    const toolGateway = aiFactory.getToolGateway();

    const aiResponse = await provider.generateResponse(
      {
        message: cleanMessage,
        language: typeof language === "string" ? language.slice(0, 10) : "en",
        conversationHistory: validHistory,
        context: {
          userId: citizen.id,
          citizenName: profile?.displayName,
          ip: req.ip,
        },
      },
      toolGateway
    );

    const latencyMs = aiResponse.latencyMs ?? Date.now() - routeStart;
    const isOfflineFallback = Boolean(
      aiResponse.offlineFallback || aiResponse.source.toLowerCase().includes("unavailable")
    );

    // Update non-secret runtime telemetry (for Gemini/OpenAI live requests)
    if (provider.providerName === "GeminiProvider" || provider.providerName === "OpenAIProvider") {
      runtimeTelemetry.totalRequests += 1;
      runtimeTelemetry.lastLatencyMs = latencyMs;
      if (aiResponse.fallbackAttempted) runtimeTelemetry.totalFallbacks += 1;
      if (isOfflineFallback) {
        runtimeTelemetry.totalOfflineFallbacks += 1;
        runtimeTelemetry.consecutiveFailures += 1;
        runtimeTelemetry.lastFailureAt = new Date().toISOString();
        runtimeTelemetry.lastErrorCategory = aiResponse.errorCategory || "provider_error";
      } else if (String(aiResponse.source || "").startsWith("Google Gemini")) {
        runtimeTelemetry.consecutiveFailures = 0;
        runtimeTelemetry.lastSuccessAt = new Date().toISOString();
        runtimeTelemetry.lastSuccessModel = aiResponse.model || "gemini-4-hydrogen";
      }
    }

    // 4. Audit Response Generation
    try {
      db.insertAuditEvent({
        actorId: citizen.id,
        actorName: profile?.displayName || citizen.identifier,
        actorRole: "CITIZEN",
        action: "AI_RESPONSE_GENERATED",
        resource: "U_AI:CHAT",
        result: isOfflineFallback ? "FAILED" : "SUCCESS",
        context: JSON.stringify({
          correlationId,
          provider: provider.providerName,
          intent: aiResponse.intent || null,
          model: aiResponse.model || null,
          fallbackAttempted: Boolean(aiResponse.fallbackAttempted),
          offlineFallback: isOfflineFallback,
          errorCategory: aiResponse.errorCategory || null,
          latencyMs,
          source: aiResponse.source,
          outcome: isOfflineFallback ? "OFFLINE_LOCAL_FALLBACK" : "RESPONSE_RETURNED",
          toolCallsCount: aiResponse.toolCalls?.length || 0,
        }),
        ipAddress: req.ip,
      });
    } catch {
      // Non-blocking audit error
    }

    return res.json({
      success: true,
      correlationId,
      reply: aiResponse.reply,
      source: aiResponse.source,
      model: aiResponse.model,
      intent: aiResponse.intent,
      retrieval: aiResponse.retrieval,
      fallbackAttempted: Boolean(aiResponse.fallbackAttempted),
      offlineFallback: isOfflineFallback,
      errorCategory: aiResponse.errorCategory,
      latencyMs,
      suggestions: aiResponse.suggestions || [],
      toolCalls: aiResponse.toolCalls || [],
      citations: aiResponse.citations || [],
      disclaimer: aiResponse.disclaimer,
      timestamp: aiResponse.timestamp,
    });
  } catch (err: any) {
    console.error("AI chat error:", { correlationId, message: err?.message || err });
    return res.status(500).json({
      success: false,
      correlationId,
      error: "An error occurred while generating AI guidance. Please try again later.",
    });
  }
});

/**
 * POST /api/v1/ai/explain
 * Terminology Explainer Endpoint backed by shared verified statutory glossary
 */
aiRouter.post("/explain", csrfProtection, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { term } = req.body || {};
    if (!term || typeof term !== "string" || !term.trim()) {
      return res.status(400).json({
        success: false,
        error: "Term parameter is required.",
      });
    }

    const cleanTerm = term.toLowerCase().trim();
    if (cleanTerm.length > 100) {
      return res.status(400).json({
        success: false,
        error: "Term parameter exceeds maximum length of 100 characters.",
      });
    }

    const match = lookupGlossaryTerm(cleanTerm);
    if (!match) {
      return res.status(404).json({
        success: false,
        known: false,
        term: cleanTerm,
        error: "No verified statutory glossary entry found for this term. Try asking Bharat G-Bot for conversational guidance.",
      });
    }

    return res.json({
      success: true,
      known: true,
      term: cleanTerm,
      matchedKey: match.matchedKey,
      explanation: {
        simpleExplanation: match.entry.simpleExplanation,
        realLifeExample: match.entry.realLifeExample,
        whyGovernmentAsks: match.entry.whyGovernmentAsks,
        whereToGetIt: match.entry.whereToGetIt,
        documentsNeeded: match.entry.documentsNeeded,
        issuingAuthority: match.entry.issuingAuthority,
      },
      disclaimer: "AI-generated educational explanation. Refer to state revenue departments for statutory guidelines.",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Failed to explain term.",
    });
  }
});
