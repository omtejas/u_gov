/**
 * U-AI — Google Gemini AI Provider with Controlled Tool Grounding
 *
 * Connects to Google GenAI when GEMINI_API_KEY is configured.
 * Automatically falls back to MockAIProvider if unavailable or timed out.
 * Enforces bounded timeouts and strict zero secret leakage.
 */

import { GoogleGenAI } from "@google/genai";
import {
  AIProvider,
  AIChatRequest,
  AIChatResponse,
  IAIToolGateway,
} from "./AIProvider";
import { MockAIProvider } from "./MockAIProvider";

export class GeminiProvider implements AIProvider {
  public readonly providerName = "GeminiProvider";
  private fallbackProvider: MockAIProvider;
  private client: GoogleGenAI | null = null;

  constructor() {
    this.fallbackProvider = new MockAIProvider();
    if (process.env.GEMINI_API_KEY) {
      try {
        this.client = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "u-gov-sovereign-dpi/ai-gateway",
            },
          },
        });
      } catch (err) {
        console.warn("Notice: Gemini client initialization skipped:", err);
      }
    }
  }

  public async generateResponse(
    request: AIChatRequest,
    toolGateway: IAIToolGateway
  ): Promise<AIChatResponse> {
    if (!this.client) {
      return this.fallbackProvider.generateResponse(request, toolGateway);
    }

    try {
      // Gather ground-truth context from tool gateway first to ground Gemini
      const searchResults = await toolGateway.searchServices(request.message);
      const groundedContext = searchResults
        .slice(0, 3)
        .map(
          (s) =>
            `- Service: ${s.name} (${s.serviceCode})\n  Department: ${s.department}\n  SLA: ${s.slaDays} days\n  Fee: ₹${s.fee}\n  Description: ${s.description}`
        )
        .join("\n\n");

      const systemInstruction = `You are Bharat G-Bot, the Sovereign AI Public Services Assistant of U-GOV India (Unified Governance & Citizen Services Platform).
Your mission is to guide Indian citizens regarding central & state schemes, eligibility rules, required documents, and application tracking with zero hallucination.
Ground your answer in verified U-SERVICES facts:
${groundedContext ? `Verified Platform Services:\n${groundedContext}` : "Provide factual public service guidance."}

Rules:
1. Always be concise, clear, and structured.
2. Clearly distinguish verified catalogue facts from general guidance.
3. Remind citizens that official application submission requires their explicit action and consent in U-GOV.
4. Do NOT hallucinate application statuses or private records.`;

      const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

      if (Array.isArray(request.conversationHistory)) {
        for (const item of request.conversationHistory) {
          if (!item.text) continue;
          contents.push({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: item.text.slice(0, 500) }],
          });
        }
      }

      contents.push({ role: "user", parts: [{ text: request.message.slice(0, 1000) }] });

      const geminiPromise = this.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: { systemInstruction, temperature: 0.3 },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini API call timed out")), 7000)
      );

      const response: any = await Promise.race([geminiPromise, timeoutPromise]);

      if (response && response.text) {
        return {
          reply: response.text.trim(),
          source: "Gemini-2.5-Flash (U-GOV Grounded Engine)",
          suggestions: [
            "Check My Document Readiness",
            "View in Services Directory",
            "What are the required documents?",
          ],
          disclaimer: "AI-generated guidance. Verify important information before submission.",
          timestamp: new Date().toISOString(),
        };
      }

      // If empty response, fallback
      return this.fallbackProvider.generateResponse(request, toolGateway);
    } catch (err: any) {
      console.warn("Gemini provider fallback engaged:", err?.message || err);
      return this.fallbackProvider.generateResponse(request, toolGateway);
    }
  }
}
