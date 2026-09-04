/**
 * U-AI — Secure Citizen Assistance & Intelligence API Routes
 *
 * Endpoints for Bharat G-Bot sovereign AI assistant, grounded in U-SERVICES
 * and governed by authenticated citizen authorization and U-AUDIT logging.
 */

import { Router, Response } from "express";
import { AuthenticatedRequest, requireAuth, rateLimiter } from "../middleware/auth";
import { aiFactory } from "../ai";
import { db } from "../database/db";

export const aiRouter = Router();

// Apply sliding-window rate limiter to AI endpoints (max 30 queries per minute per IP)
aiRouter.use(rateLimiter(60000, 30));

/**
 * GET /api/v1/ai/health
 * Public telemetry for AI service readiness
 */
aiRouter.get("/health", (_req, res: Response) => {
  const provider = aiFactory.getAIProvider();
  return res.json({
    status: "HEALTHY",
    provider: provider.providerName,
    externalProviderAvailable: Boolean(process.env.GEMINI_API_KEY),
    mode: "SOVEREIGN_GROUNDED_ASSISTANT",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/v1/ai/chat
 * Authenticated sovereign citizen AI assistant
 */
aiRouter.post("/chat", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

    // 4. Audit Response Generation
    try {
      db.insertAuditEvent({
        actorId: citizen.id,
        actorName: profile?.displayName || citizen.identifier,
        actorRole: "CITIZEN",
        action: "AI_RESPONSE_GENERATED",
        resource: "U_AI:CHAT",
        result: "SUCCESS",
        context: JSON.stringify({
          provider: provider.providerName,
          source: aiResponse.source,
          toolCallsCount: aiResponse.toolCalls?.length || 0,
        }),
        ipAddress: req.ip,
      });
    } catch {
      // Non-blocking audit error
    }

    return res.json({
      success: true,
      reply: aiResponse.reply,
      source: aiResponse.source,
      suggestions: aiResponse.suggestions || [],
      toolCalls: aiResponse.toolCalls || [],
      disclaimer: aiResponse.disclaimer,
      timestamp: aiResponse.timestamp,
    });
  } catch (err: any) {
    console.error("AI chat error:", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "An error occurred while generating AI guidance. Please try again later.",
    });
  }
});

/**
 * POST /api/v1/ai/explain
 * Terminology Explainer Endpoint
 */
aiRouter.post("/explain", async (req: AuthenticatedRequest, res: Response) => {
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

    const glossary: Record<string, any> = {
      domicile: {
        simpleExplanation: "A Domicile Certificate is official proof that you have resided in a particular State continuously for 10-15 years.",
        realLifeExample: "Required when applying for state engineering/medical college seats under local state quota.",
        whyGovernmentAsks: "To ensure state benefits reach genuine residents of that state.",
        whereToGetIt: "Tehsildar Office, Citizen Service Center (CSC), or State Seva Portal.",
        documentsNeeded: ["Aadhaar Card", "Ration Card or Electricity Bill (10+ yrs)", "School Leaving Certificate", "Affidavit"],
        issuingAuthority: "Sub-Divisional Magistrate (SDM) / Tehsildar",
      },
      "non-creamy layer": {
        simpleExplanation: "An official certificate showing your family's annual income is below the OBC Creamy Layer limit (currently ₹8 Lakh/year).",
        realLifeExample: "If your family earns ₹4.5 Lakh/year, this proves you qualify for OBC quota reservation benefits.",
        whyGovernmentAsks: "To ensure reservation benefits reach families in genuine financial need.",
        whereToGetIt: "Revenue Department or District Magistrate Office.",
        documentsNeeded: ["Caste Certificate", "Income Certificate for last 3 years", "Form 16 / ITR", "Aadhaar Card"],
        issuingAuthority: "Revenue Officer / SDO",
      },
      mutation: {
        simpleExplanation: "Land Mutation (Ferfar / Dakhil Kharij) is the official transfer of ownership title in government revenue records after buying land.",
        realLifeExample: "Updates the government land ledger so property tax notices are billed to the new buyer.",
        whyGovernmentAsks: "To maintain an accurate public record of legal land ownership.",
        whereToGetIt: "Talathi / Patwari Office or State Bhulekh online portal.",
        documentsNeeded: ["Registered Sale Deed", "Previous 7/12 Extract", "Identity Proof", "Affidavit"],
        issuingAuthority: "Tehsildar / Land Records Department",
      },
    };

    const matchKey = Object.keys(glossary).find((k) => cleanTerm.includes(k)) || "domicile";

    return res.json({
      success: true,
      term: cleanTerm,
      explanation: glossary[matchKey],
      disclaimer: "AI-generated educational explanation. Refer to state revenue departments for statutory guidelines.",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Failed to explain term.",
    });
  }
});
