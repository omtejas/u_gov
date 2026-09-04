/**
 * U-AI — AI Provider Factory and Registry
 *
 * Resolves the active AI provider based on environment configuration.
 * Allows dependency injection for tests to guarantee deterministic execution.
 */

import { AIProvider, IAIToolGateway } from "./AIProvider";
import { MockAIProvider } from "./MockAIProvider";
import { GeminiProvider } from "./GeminiProvider";
import { AIToolGateway } from "./AIToolGateway";

class AIFactory {
  private customProvider: AIProvider | null = null;
  private defaultToolGateway: IAIToolGateway | null = null;

  public getAIProvider(): AIProvider {
    if (this.customProvider) {
      return this.customProvider;
    }

    if (process.env.GEMINI_API_KEY && process.env.NODE_ENV !== "test") {
      return new GeminiProvider();
    }

    return new MockAIProvider();
  }

  public setAIProvider(provider: AIProvider): void {
    this.customProvider = provider;
  }

  public resetAIProvider(): void {
    this.customProvider = null;
  }

  public getToolGateway(): IAIToolGateway {
    if (!this.defaultToolGateway) {
      this.defaultToolGateway = new AIToolGateway();
    }
    return this.defaultToolGateway;
  }
}

export const aiFactory = new AIFactory();
