// U-GOV Core Data Contracts & Domain Types

export type UserRole = "citizen" | "official" | "admin";
export type UserMode = "citizen" | "official" | "admin" | "simple";
export type LanguageCode = "en" | "hi" | "mr" | "kn";

export interface UserProfile {
  id: string;
  uId: string; // Unified Citizen ID (e.g. U-9842-8821-IND)
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  kycLevel: "Tier 1 (Basic)" | "Tier 2 (Verified)" | "Tier 3 (High-Assurance)" | "Tier 4 (Sovereign Full-KYC)";
  aadhaarLinked: boolean;
  panLinked: boolean;
  state: string;
  district: string;
  avatarUrl?: string;
}

export type ServiceStatus = 
  | "available" 
  | "connected" 
  | "auth_required" 
  | "prototype" 
  | "coming_soon" 
  | "maintenance";

export type ServiceCategory =
  | "identity"
  | "education"
  | "agriculture"
  | "healthcare"
  | "transport"
  | "housing"
  | "business"
  | "welfare"
  | "finance";

export interface GovService {
  id: string;
  name: string;
  shortCode: string;
  department: string;
  ministry: string;
  category: ServiceCategory;
  description: string;
  benefits: string[];
  eligibility: string[];
  requiredDocs: string[];
  slaDays: number;
  fee: number;
  officialPortal: string;
  status: ServiceStatus;
  isPopular?: boolean;
  featured?: boolean;
  externalRedirect?: boolean;
}

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "action_required"
  | "approved"
  | "rejected"
  | "completed";

export type ControlledApplicationStatus =
  | "DRAFT"
  | "DOCUMENTS_REQUIRED"
  | "READY"
  | "CONSENT_REQUIRED"
  | "CONSENT_GRANTED"
  | "SUBMITTED"
  | "PROCESSING"
  | "ACTION_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface TimelineStep {
  title: string;
  timestamp?: string;
  completed: boolean;
  current?: boolean;
  notes?: string;
}

export interface GovApplication {
  id: string;
  refNumber: string; // e.g. UGOV-2026-NSP-891023
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  department: string;
  status: ApplicationStatus;
  submittedAt: string;
  updatedAt: string;
  slaTargetDate: string;
  actionRequiredText?: string;
  timeline: TimelineStep[];
  feePaid: number;
  isSimulated?: boolean;
}

export interface GovernmentApplication {
  id: string;
  applicationNumber: string;
  userId: string;
  serviceId: string;
  status: ControlledApplicationStatus;
  formData: Record<string, any>;
  attachedDocumentIds: string[];
  consentIds: string[];
  trackingToken?: string | null;
  submittedAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  service?: {
    id: string;
    serviceCode: string;
    name: string;
    department: string;
    ministry: string;
    category?: string;
    slaDays: number;
    fee: number;
  } | null;
  attachedDocuments?: DigiDocument[];
}

export interface ApplicationReviewData {
  application: {
    id: string;
    applicationNumber: string;
    status: ControlledApplicationStatus;
    formData: Record<string, any>;
    createdAt: string;
    submittedAt?: string | null;
  };
  service: {
    id: string;
    serviceCode: string;
    name: string;
    department: string;
    ministry: string;
    slaDays: number;
    fee: number;
  };
  attachedDocuments: {
    id: string;
    title: string;
    documentTypeId: string;
    documentNumber: string;
    sha256Checksum: string;
    verificationStatus: string;
  }[];
  requirements: {
    totalRequired: number;
    attachedCount: number;
    satisfied: boolean;
    missingDocumentTypeIds: string[];
  };
  dataSharingDisclosure: {
    recipientEntity: string;
    purpose: string;
    validityDays: number;
    accessType: string;
    documentsToShare: {
      id: string;
      title: string;
      documentTypeId: string;
      sha256Checksum: string;
    }[];
  };
}

export interface ServiceRequirementItem {
  documentTypeId: string;
  documentTypeName: string;
  issuingAuthority: string;
  satisfied: boolean;
  matchedDocument?: {
    id: string;
    title: string;
    documentNumber: string;
    fileName: string;
    sha256Checksum: string;
    verificationStatus: string;
    createdAt: string;
  };
}

export interface ServiceRequirementsEvaluation {
  service: {
    id: string;
    serviceCode: string;
    name: string;
    department: string;
  };
  totalRequired: number;
  satisfiedCount: number;
  missingCount: number;
  isApplicationReady: boolean;
  readinessPercentage: number;
  requirements: ServiceRequirementItem[];
}

export interface DocumentType {
  id: string;
  name: string;
  issuingAuthority: string;
  retentionDays: number | null;
}

export interface ConsentRecord {
  id: string;
  documentId?: string;
  accessor: string;
  recipientEntity?: string;
  purpose: string;
  grantedAt: string;
  expiresAt: string;
  revokedAt?: string;
  status: "active" | "revoked" | "expired";
}

export type DocumentVerificationStatus =
  | "SELF_ATTESTED"
  | "INTEGRITY_VERIFIED"
  | "SANDBOX_SIMULATED"
  | "EXTERNALLY_VERIFIED";

export interface DigiDocument {
  id: string;
  name: string;
  docNumber: string;
  type: string;
  documentTypeId?: string;
  issuer: string;
  issuedAt: string;
  verified: boolean;
  verificationStatus?: DocumentVerificationStatus;
  fileSize: string;
  fileSizeBytes?: number;
  fileName?: string;
  mimeType?: string;
  sha256Checksum?: string;
  storageKey?: string;
  consents: ConsentRecord[];
  integrityStatus?: "VALID" | "FAILED" | "UNVERIFIED";
  lastVerifiedAt?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: {
    name: string;
    uId: string;
    role: string;
    ipAddress?: string;
  };
  action: string;
  resource: string;
  result: "SUCCESS" | "WARNING" | "BLOCKED" | "INFO";
  context: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "status" | "alert" | "reminder" | "security";
  priority: "high" | "normal" | "low";
  read: boolean;
  relatedRef?: string;
}

export interface CivicGrievance {
  id: string;
  ticketId: string;
  title: string;
  category: string;
  department: string;
  location: string;
  status: "Open" | "Assigned" | "In-Progress" | "Resolved";
  filedAt: string;
  upvotes: number;
  description: string;
}
