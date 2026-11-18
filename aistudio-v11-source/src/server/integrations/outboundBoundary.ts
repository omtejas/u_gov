/**
 * Outbound Destination Boundary & Security Controls
 * 
 * Strict destination enforcement:
 * 1. Blocks arbitrary external calls.
 * 2. In Sandbox mode, only permits approved mock/internal destination schemes.
 * 3. Prevents SSRF attacks from user-supplied parameters.
 */

export const APPROVED_SANDBOX_DESTINATIONS = [
  "mock://bharat-bus.internal/nsp",
  "mock://bharat-bus.internal/sarathi",
  "mock://bharat-bus.internal/mahadbt",
  "mock://bharat-bus.internal/pmkisan",
  "mock://bharat-bus.internal/ayushman",
  "mock://bharat-bus.internal/revenue",
  "mock://bharat-bus.internal/default",
] as const;

export class OutboundDestinationBoundary {
  /**
   * Validates whether a target provider URL is explicitly on the approved allowlist
   */
  public static validateDestination(url: string, allowSandboxMockOnly: boolean = true): boolean {
    if (!url || typeof url !== "string") {
      return false;
    }

    const trimmed = url.trim().toLowerCase();

    // In sandbox, strictly require mock internal protocol
    if (allowSandboxMockOnly) {
      return APPROVED_SANDBOX_DESTINATIONS.some((dest) => trimmed.startsWith(dest));
    }

    // SSRF Protections: Disallow private IP ranges, loopback, file://, gopher://, metadata endpoints
    const forbiddenPatterns = [
      /^https?:\/\/127\./,
      /^https?:\/\/localhost/i,
      /^https?:\/\/169\.254\./, // AWS/GCP/Azure instance metadata
      /^https?:\/\/10\./,
      /^https?:\/\/192\.168\./,
      /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^file:\/\//i,
      /^gopher:\/\//i,
      /^dict:\/\//i,
      /^ldap:\/\//i,
    ];

    if (forbiddenPatterns.some((pattern) => pattern.test(trimmed))) {
      return false;
    }

    return false;
  }
}
