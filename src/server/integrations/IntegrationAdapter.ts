/**
 * U-GOV Government Systems Integration Adapter Interface
 * 
 * Provides an architectural boundary isolating U-APPLICATIONS core lifecycle
 * from external department gateways, state portals, and national infrastructure.
 * 
 * NOTE: U-GOV operates strictly under Sandbox Simulation for Phase 4.2.
 * No direct or unverified production calls are made to real government endpoints.
 */

export interface ApplicationSubmissionPayload {
  applicationId: string;
  applicationNumber: string;
  serviceCode: string;
  serviceName: string;
  citizenUserId: string;
  formData: Record<string, any>;
  attachedDocuments: {
    documentId: string;
    documentTypeId: string;
    title: string;
    documentNumber: string;
    sha256Checksum: string;
  }[];
  consentIds: string[];
}

export interface ApplicationSubmissionResult {
  success: boolean;
  trackingToken: string;
  externalReference: string;
  status: "SUBMITTED" | "PROCESSING";
  submittedAt: string;
  estimatedSlaDays: number;
  acknowledgementNotice: string;
}

export interface ApplicationStatusResult {
  applicationNumber: string;
  trackingToken: string;
  status: "SUBMITTED" | "PROCESSING" | "ACTION_REQUIRED" | "APPROVED" | "REJECTED";
  remarks?: string;
  lastUpdated: string;
}

export interface IntegrationAdapter {
  submitApplication(payload: ApplicationSubmissionPayload): Promise<ApplicationSubmissionResult>;
  getApplicationStatus(applicationNumber: string, trackingToken: string): Promise<ApplicationStatusResult>;
  cancelApplication(applicationNumber: string, reason?: string): Promise<{ success: boolean; cancelledAt: string }>;
}
