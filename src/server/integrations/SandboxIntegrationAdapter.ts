import crypto from "crypto";
import {
  IntegrationAdapter,
  IntegrationRequest,
  IntegrationResponse,
  StatusRequest,
  StatusResponse,
  CancelRequest,
  CancelResponse,
  ProviderInfo,
  IntegrationCapabilities,
  HealthStatus,
  IntegrationError,
  NormalizedApplicationStatus,
} from "./IntegrationAdapter";
import { OutboundDestinationBoundary } from "./outboundBoundary";

export type SandboxSimulationBehavior =
  | "NORMAL"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "VALIDATION_ERROR"
  | "AUTH_FAILURE"
  | "ACTION_REQUIRED"
  | "APPROVED"
  | "REJECTED";

/**
 * Hardened Sandbox Integration Adapter (Phase 5)
 * 
 * Simulates real government gateways (e.g. NSP, Sarathi, MahaDBT) in an isolated,
 * deterministic environment with zero outbound HTTP requests.
 */
export class SandboxIntegrationAdapter implements IntegrationAdapter {
  public readonly providerCode: string;
  public readonly displayName: string;
  public readonly supportedServices: string[];
  public readonly destinationUrl: string;
  private simulationBehavior: SandboxSimulationBehavior = "NORMAL";
  private mockLatencyMs: number = 20;

  constructor(
    providerCode: string = "SANDBOX_DEFAULT",
    displayName: string = "U-GOV National Sandbox Gateway",
    supportedServices: string[] = ["*"],
    destinationUrl: string = "mock://bharat-bus.internal/default"
  ) {
    this.providerCode = providerCode;
    this.displayName = displayName;
    this.supportedServices = supportedServices;
    this.destinationUrl = destinationUrl;

    // Outbound security check
    if (!OutboundDestinationBoundary.validateDestination(this.destinationUrl, true)) {
      throw new Error(`Security Exception: Unapproved sandbox destination ${this.destinationUrl}`);
    }
  }

  public setSimulationBehavior(behavior: SandboxSimulationBehavior, mockLatencyMs: number = 20): void {
    this.simulationBehavior = behavior;
    this.mockLatencyMs = mockLatencyMs;
  }

  public getProviderInfo(): ProviderInfo {
    return {
      providerCode: this.providerCode,
      displayName: this.displayName,
      environment: "SANDBOX",
      supportedServices: this.supportedServices,
      capabilities: this.getCapabilities(),
      status: "AVAILABLE",
      version: "5.0.0-sandbox",
      disclaimer: "Sandbox Simulation only. No connection made to live government systems.",
    };
  }

  public getCapabilities(): IntegrationCapabilities {
    return {
      canSubmit: true,
      canPollStatus: true,
      canCancel: true,
      supportsWebhooks: false,
      idempotencySupported: true,
      supportedDocumentTypes: ["AADHAAR", "PAN", "DRIVING_LICENCE", "DOMICILE", "INCOME_CERT", "MARKSHEET"],
    };
  }

  public async healthCheck(): Promise<HealthStatus> {
    return {
      status: "HEALTHY",
      providerCode: this.providerCode,
      latencyMs: this.mockLatencyMs,
      timestamp: new Date().toISOString(),
      environment: "SANDBOX",
      details: {
        mode: "DETERMINISTIC_SANDBOX",
        behavior: this.simulationBehavior,
        approvedEndpoint: this.destinationUrl,
      },
    };
  }

  public async submitApplication(request: IntegrationRequest): Promise<IntegrationResponse> {
    const startTime = Date.now();
    const correlationId = request.correlationId || `UGOV-INT-${crypto.randomBytes(6).toString("hex")}`;

    if (this.mockLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.mockLatencyMs));
    }

    if (this.simulationBehavior === "TIMEOUT") {
      // Simulate extreme delay causing timeout
      await new Promise((resolve) => setTimeout(resolve, 8000));
      throw new IntegrationError(
        `Upstream gateway ${this.providerCode} timed out.`,
        "INTEGRATION_TIMEOUT",
        this.providerCode,
        correlationId,
        504,
        true
      );
    }

    if (this.simulationBehavior === "PROVIDER_ERROR") {
      throw new IntegrationError(
        `Upstream gateway error encountered in ${this.providerCode}.`,
        "INTEGRATION_PROVIDER_ERROR",
        this.providerCode,
        correlationId,
        502,
        true
      );
    }

    if (this.simulationBehavior === "VALIDATION_ERROR") {
      throw new IntegrationError(
        `Application data rejected by statutory schema validator for ${request.serviceCode}.`,
        "INTEGRATION_VALIDATION_ERROR",
        this.providerCode,
        correlationId,
        400,
        false
      );
    }

    if (this.simulationBehavior === "AUTH_FAILURE") {
      throw new IntegrationError(
        `Integration authentication failed for departmental gateway ${this.providerCode}.`,
        "INTEGRATION_AUTH_FAILURE",
        this.providerCode,
        correlationId,
        401,
        false
      );
    }

    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const trackingToken = `SBX-ACK-${request.serviceCode}-${randomHex}`;
    const providerApplicationId = `DEPT-REF-${Date.now()}-${randomHex}`;

    return {
      success: true,
      providerCode: this.providerCode,
      providerApplicationId,
      externalReference: providerApplicationId,
      trackingToken,
      status: "SUBMITTED",
      submittedAt: new Date().toISOString(),
      estimatedSlaDays: 14,
      acknowledgementNotice: `Application ${request.applicationNumber} accepted by U-GOV Sandbox Gateway (${this.displayName}). Safe prototype simulation active.`,
      correlationId,
      executionDurationMs: Date.now() - startTime,
      simulatedEnvironment: "SANDBOX",
    };
  }

  public async getApplicationStatus(request: StatusRequest): Promise<StatusResponse> {
    const correlationId = request.correlationId || `UGOV-INT-${crypto.randomBytes(6).toString("hex")}`;

    if (this.mockLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.mockLatencyMs));
    }

    let status: NormalizedApplicationStatus = "PROCESSING";
    let remarks = "Application undergoing formal review in Sandbox Departmental Directorate.";

    if (this.simulationBehavior === "APPROVED") {
      status = "APPROVED";
      remarks = "Application approved by statutory authority in sandbox simulation.";
    } else if (this.simulationBehavior === "REJECTED") {
      status = "REJECTED";
      remarks = "Application rejected due to simulated statutory eligibility mismatch.";
    } else if (this.simulationBehavior === "ACTION_REQUIRED") {
      status = "ACTION_REQUIRED";
      remarks = "Additional documents requested by departmental reviewing officer.";
    }

    return {
      success: true,
      providerCode: this.providerCode,
      applicationNumber: request.applicationNumber,
      trackingToken: request.trackingToken,
      status,
      remarks,
      lastUpdated: new Date().toISOString(),
      correlationId,
      simulatedEnvironment: "SANDBOX",
    };
  }

  public async cancelApplication(request: CancelRequest): Promise<CancelResponse> {
    const correlationId = request.correlationId || `UGOV-INT-${crypto.randomBytes(6).toString("hex")}`;

    if (this.mockLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.mockLatencyMs));
    }

    return {
      success: true,
      providerCode: this.providerCode,
      applicationNumber: request.applicationNumber,
      cancelledAt: new Date().toISOString(),
      correlationId,
      message: `Application ${request.applicationNumber} successfully cancelled in sandbox provider ${this.providerCode}.`,
    };
  }
}
