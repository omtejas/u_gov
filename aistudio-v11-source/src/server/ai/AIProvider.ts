/**
 * U-AI — Normalized Provider and Tool Gateway Contracts
 *
 * Provides a vendor-agnostic abstraction for AI assistants.
 * Ensures zero secret exposure, bounded inputs/outputs, and strict grounding
 * in verified U-SERVICES facts.
 */

export interface AIChatMessage {
  role: "user" | "model" | "assistant" | "system";
  text: string;
}

export interface AIToolContext {
  userId: string;
  citizenName?: string;
  ip?: string;
}

export interface AIToolResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
}

export interface AIChatRequest {
  message: string;
  language?: string;
  conversationHistory?: AIChatMessage[];
  context: AIToolContext;
}

export interface AIResponseCitation {
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
  sourceType: "u-gov" | "internet";
}

export interface AIRetrievalTrace {
  intent: string;
  candidatesEvaluated: number;
  serviceSearchAllowed: boolean;
  faqSearchAllowed: boolean;
  knowledgeMatches: Array<{ key: string; title: string; category: string; score: number; matchedTerms: string[] }>;
  serviceMatches: Array<{ serviceCode: string; name: string; score: number; matchedTerms: string[] }>;
  faqMatches: Array<{ title: string; category: string; score: number; matchedTerms: string[] }>;
  suppressedIrrelevant: boolean;
}

export interface AIChatResponse {
  reply: string;
  source: string;
  model?: string;
  intent?: string;
  retrieval?: AIRetrievalTrace;
  fallbackAttempted?: boolean;
  offlineFallback?: boolean;
  errorCategory?: string;
  latencyMs?: number;
  citations?: AIResponseCitation[];
  suggestions?: string[];
  toolCalls?: AIToolResult[];
  disclaimer: string;
  timestamp: string;
}

export interface IAIToolGateway {
  searchServices(query: string, category?: string): Promise<any[]>;
  searchKnowledge?(query: string, allowedCategories?: string[]): Promise<any[]>;
  getServiceDetails(serviceCode: string): Promise<any>;
  checkRequirements(serviceCode: string): Promise<any>;
  getCitizenApplicationStatus(applicationNumberOrId: string, context: AIToolContext): Promise<any>;
  getCitizenDocumentReadiness(serviceCode: string, context: AIToolContext): Promise<any>;
}

export interface AIProvider {
  readonly providerName: string;
  generateResponse(request: AIChatRequest, toolGateway: IAIToolGateway): Promise<AIChatResponse>;
}
