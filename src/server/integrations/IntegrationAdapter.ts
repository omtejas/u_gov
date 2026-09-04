/**
 * U-GOV Government Systems Integration Adapter Architecture (Phase 5)
 * 
 * Provides an architectural boundary isolating U-APPLICATIONS core lifecycle
 * from external department gateways, state portals, and national infrastructure.
 * 
 * NOTE: U-GOV operates strictly under Sandbox Simulation for Phase 5.
 * No direct or unverified production calls are made to real government endpoints.
 */

export type IntegrationEnvironment = "SANDBOX" | "STAGING" | "PRODUCTION";

export interface ProviderInfo {
  providerCode: string;
  displayName: string;
  environment: IntegrationEnvironment;
  supportedServices: string[];
  capabilities: IntegrationCapabilities;
  status: "AVAILABLE" | "DEGRADED" | "MAINTENANCE" | "UNAVAILABLE";
  version: string;
  disclaimer: string;
}

export interface IntegrationCapabilities {
  canSubmit: boolean;
  canPollStatus: boolean;
  canCancel: boolean;
  supportsWebhooks: boolean;
  idempotencySupported: boolean;
  supportedDocumentTypes: string[];
}

export interface HealthStatus {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  providerCode: string;
  latencyMs: number;
  timestamp: string;
  environment: IntegrationEnvironment;
  details?: Record<string, any>;
}

export interface IntegrationAttachedDocument {
  documentId: string;
  documentTypeId: string;
  title: string;
  documentNumber: string;
  sha256Checksum: string;
}

export interface IntegrationRequest {
  applicationId: string;
  applicationNumber: string;
  serviceCode: string;
  serviceName: string;
  citizenUserId: string;
  formData: Record<string, any>;
  attachedDocuments: IntegrationAttachedDocument[];
  consentIds: string[];
  correlationId?: string;
  idempotencyKey?: string;
  targetEnvironment?: IntegrationEnvironment;
}

// Backward-compatible alias
export type ApplicationSubmissionPayload = IntegrationRequest;

export type NormalizedApplicationStatus =
  | "SUBMITTED"
  | "PROCESSING"
  | "ACTION_REQUIRED"
  | "APPROVED"
  | "REJECTED";

export interface IntegrationResponse {
  success: boolean;
  providerCode: string;
  providerApplicationId: string;
  externalReference?: string;
  trackingToken: string;
  status: "SUBMITTED" | "PROCESSING";
  submittedAt: string;
  estimatedSlaDays: number;
  acknowledgementNotice: string;
  correlationId: string;
  executionDurationMs: number;
  simulatedEnvironment?: IntegrationEnvironment;
}

// Backward-compatible alias
export type ApplicationSubmissionResult = IntegrationResponse;

export interface StatusRequest {
  applicationId: string;
  applicationNumber: string;
  serviceCode: string;
  trackingToken: string;
  correlationId?: string;
}

export interface StatusResponse {
  success: boolean;
  providerCode: string;
  applicationNumber: string;
  trackingToken: string;
  status: NormalizedApplicationStatus;
  remarks?: string;
  lastUpdated: string;
  correlationId: string;
  simulatedEnvironment: IntegrationEnvironment;
}

// Backward-compatible alias
export interface ApplicationStatusResult {
  applicationNumber: string;
  trackingToken: string;
  status: NormalizedApplicationStatus;
  remarks?: string;
  lastUpdated: string;
}

export interface CancelRequest {
  applicationId: string;
  applicationNumber: string;
  serviceCode: string;
  trackingToken?: string | null;
  reason?: string;
  correlationId?: string;
}

export interface CancelResponse {
  success: boolean;
  providerCode: string;
  applicationNumber: string;
  cancelledAt: string;
  correlationId: string;
  message: string;
}

export type IntegrationErrorCode =
  | "INTEGRATION_TIMEOUT"
  | "INTEGRATION_UNAVAILABLE"
  | "INTEGRATION_AUTH_FAILURE"
  | "INTEGRATION_VALIDATION_ERROR"
  | "INTEGRATION_RATE_LIMITED"
  | "INTEGRATION_DUPLICATE"
  | "INTEGRATION_PROVIDER_ERROR"
  | "INTEGRATION_UNSUPPORTED"
  | "INTEGRATION_DESTINATION_BLOCKED"
  | "INTEGRATION_UNKNOWN_ERROR";

export class IntegrationError extends Error {
  public readonly code: IntegrationErrorCode;
  public readonly providerCode: string;
  public readonly correlationId: string;
  public readonly retryable: boolean;
  public readonly statusCode: number;

  constructor(
    message: string,
    code: IntegrationErrorCode,
    providerCode: string,
    correlationId: string,
    statusCode: number = 502,
    retryable: boolean = false
  ) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
    this.providerCode = providerCode;
    this.correlationId = correlationId;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

/**
 * Main Integration Adapter Contract
 */
export interface IntegrationAdapter {
  getProviderInfo(): ProviderInfo;
  getCapabilities(): IntegrationCapabilities;
  healthCheck(): Promise<HealthStatus>;
  submitApplication(request: IntegrationRequest): Promise<IntegrationResponse>;
  getApplicationStatus(request: StatusRequest): Promise<StatusResponse>;
  cancelApplication(request: CancelRequest): Promise<CancelResponse>;
}
