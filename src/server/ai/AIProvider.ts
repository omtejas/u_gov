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

export interface AIChatResponse {
  reply: string;
  source: string;
  suggestions?: string[];
  toolCalls?: AIToolResult[];
  disclaimer: string;
  timestamp: string;
}

export interface IAIToolGateway {
  searchServices(query: string, category?: string): Promise<any[]>;
  getServiceDetails(serviceCode: string): Promise<any>;
  checkRequirements(serviceCode: string): Promise<any>;
  getCitizenApplicationStatus(applicationNumberOrId: string, context: AIToolContext): Promise<any>;
  getCitizenDocumentReadiness(serviceCode: string, context: AIToolContext): Promise<any>;
}

export interface AIProvider {
  readonly providerName: string;
  generateResponse(request: AIChatRequest, toolGateway: IAIToolGateway): Promise<AIChatResponse>;
}
