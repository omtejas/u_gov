/**
 * U-AI — Google Gemini AI Provider with Controlled Catalogue Grounding.
 * Citizen-specific document and application lookups remain inside U-GOV.
 */
import { GoogleGenAI } from "@google/genai";
import { AIProvider, AIChatRequest, AIChatResponse, IAIToolGateway } from "./AIProvider";
import { MockAIProvider } from "./MockAIProvider";

export class GeminiProvider implements AIProvider {
  public readonly providerName = "GeminiProvider";
  private fallbackProvider = new MockAIProvider();
  private client: GoogleGenAI | null = null;

  constructor() {
    if (process.env.GEMINI_API_KEY) {
      try {
        this.client = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { "User-Agent": "u-gov-ai-assistant" } },
        });
      } catch (err) {
        console.warn("Gemini client initialization skipped:", err);
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
      // Keep private citizen lookups in U-GOV's authenticated, deterministic
      // tool gateway. Never send private vault or application data to Gemini.
      const lowerMessage = request.message.toLowerCase();
      const isPrivateLookup =
        /\b(status|track|tracking|application number|where is my application)\b/.test(lowerMessage) ||
        /\b(my documents|my document|document readiness|am i ready|what am i missing)\b/.test(lowerMessage);
      if (isPrivateLookup) {
        return this.fallbackProvider.generateResponse(request, toolGateway);
      }

      // Only public catalogue facts are supplied to the external AI provider.
      // This catalogue is prototype/demo data, not a live government registry.
      const searchResults = await toolGateway.searchServices(request.message);
      const selectedService = searchResults[0];
      const serviceDetails = selectedService
        ? await toolGateway.getServiceDetails(selectedService.serviceCode)
        : null;
      const requirements = selectedService
        ? await toolGateway.checkRequirements(selectedService.serviceCode)
        : null;

      const catalogueFacts = selectedService && serviceDetails && !serviceDetails.error
        ? {
            service: {
              name: serviceDetails.name,
              code: serviceDetails.serviceCode,
              department: serviceDetails.department,
              ministry: serviceDetails.ministry,
              description: serviceDetails.description,
              category: serviceDetails.category,
              fee: serviceDetails.fee,
              estimatedProcessingDays: serviceDetails.slaDays,
              eligibilityListedInDemoCatalogue: serviceDetails.eligibility || [],
              benefitsListedInDemoCatalogue: serviceDetails.benefits || [],
              portalListedInDemoCatalogue: serviceDetails.officialPortal,
            },
            requiredDocumentsListedInDemoCatalogue:
              requirements?.requiredDocuments || serviceDetails.requiredDocuments || [],
          }
        : null;

      const systemInstruction = `You are Bharat G-Bot, an AI citizen-guidance assistant inside the U-GOV prototype.
Respond in the user's requested language (language code: ${request.language || "en"}).
The following service catalogue is prototype/demo data. It is NOT a live government registry and has NOT been independently verified against current government rules.
Catalogue facts:
${catalogueFacts ? JSON.stringify(catalogueFacts, null, 2) : "No matching service was found in the U-GOV prototype catalogue."}

Rules:
1. Be concise, clear, and structured.
2. Use only supplied catalogue facts for service-specific fees, processing times, eligibility, benefits, document lists, and portal links.
3. Never invent missing eligibility rules, documents, fees, deadlines, portal URLs, application outcomes, or government integrations.
4. If the catalogue lacks an answer, say so and direct the citizen to the relevant official department or portal for confirmation.
5. Never claim U-GOV is connected to live National Portals or government databases.
6. Never claim zero hallucinations, official approval, or legal authority.
7. Never ask for Aadhaar, PAN, bank details, passwords, OTPs, document images, or sensitive personal information.
8. Do not claim to have checked private documents or application status; those lookups stay inside U-GOV.
9. Explain that this is informational prototype guidance and current requirements must be verified with the issuing authority.`;

      // Do not forward prior chat history because it may contain personal details.
      // Redact common Indian identity/contact patterns from the current question.
      const safeMessage = request.message
        .replace(/\b\d{12}\b/g, "[REDACTED ID]")
        .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[REDACTED PAN]")
        .replace(/\b\d{10}\b/g, "[REDACTED PHONE]")
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED EMAIL]")
        .replace(/\bUGOV-\d{4}-[A-Z0-9-]+\b/gi, "[REDACTED APPLICATION ID]");

      const response = await Promise.race([
        this.client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: safeMessage.slice(0, 1000) }] }],
          config: { systemInstruction, temperature: 0.2 },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Gemini API call timed out")), 7000)
        ),
      ]);

      if (response?.text?.trim()) {
        return {
          reply: response.text.trim(),
          source: "Google Gemini 2.5 Flash + U-GOV prototype service catalogue",
          suggestions: [
            "What documents are listed for this service?",
            "Find another service in the catalogue",
            "How do I submit an application in the demo?",
          ],
          disclaimer:
            "AI-generated prototype guidance. Catalogue data may be simulated; verify current requirements with the issuing authority.",
          timestamp: new Date().toISOString(),
        };
      }

      return this.fallbackProvider.generateResponse(request, toolGateway);
    } catch (err: any) {
      console.warn("Gemini provider fallback engaged:", err?.message || err);
      return this.fallbackProvider.generateResponse(request, toolGateway);
    }
  }
}
