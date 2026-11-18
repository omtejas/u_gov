import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { hashPassword, computeAuditHash } from "../auth/crypto";
import { assertProductionStorageReady } from "../storage/storageHealth";

export interface UserRecord {
  id: string;
  identifier: string; // Email or U-ID
  passwordHash: string;
  salt: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  /** Stable Google OpenID Connect subject; never use email as provider identity. */
  googleSub?: string;
}

export interface ProfileRecord {
  id: string;
  userId: string;
  displayName: string;
  phone?: string;
  preferredLanguage: string; // en, hi, mr, kn
  kycLevel: string;
  aadhaarLinked: boolean;
  panLinked: boolean;
  state: string;
  district: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleRecord {
  id: string;
  name: string;
  description: string;
}

export interface PermissionRecord {
  id: string;
  name: string;
  description: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditEventRecord {
  id: string;
  timestamp: string;
  actorId?: string;
  actorName: string;
  actorRole: string;
  action: string;
  resource: string;
  result: "SUCCESS" | "WARNING" | "FAILED" | "BLOCKED" | "INFO";
  context: string;
  ipAddress?: string;
  prevHash?: string;
  hash?: string;
}

export interface DocumentTypeRecord {
  id: string; // 'AADHAAR', 'DRIVING_LICENCE', 'DOMICILE', 'INCOME_CERT', 'PAN', 'MARKSHEET'
  name: string;
  issuingAuthority: string;
  retentionDays: number | null;
}

export interface CitizenDocumentRecord {
  id: string;
  ownerUserId: string;
  documentTypeId: string;
  title: string;
  documentNumber: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  sha256Checksum: string;
  verificationStatus: "UNVERIFIED" | "SELF_ATTESTED" | "SANDBOX_SIMULATED" | "DIGILOCKER_VERIFIED";
  currentVersion?: number;
  issuerSignatureData?: any;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionRecord {
  id: string;
  documentId: string;
  ownerUserId: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  sha256Checksum: string;
  notes?: string;
  uploadedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert" | "status";
  priority: "high" | "normal" | "low";
  read: boolean;
  relatedRef?: string;
  createdAt: string;
}

export interface FeedbackRecord {
  id: string;
  userId: string;
  category: "bug" | "feature" | "ui" | "service" | "general" | "security";
  subject: string;
  message: string;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  status: "RECEIVED" | "REVIEWED" | "RESOLVED";
  createdAt: string;
}

export interface UserPreferencesRecord {
  userId: string;
  preferredLanguage?: string;
  notificationsEnabled?: boolean;
  tutorialSeen?: boolean;
  dashboardLayout?: string;
  theme?: string;
  updatedAt: string;
}

export interface GrievanceRecord {
  id: string;
  ticketId: string;
  ownerUserId: string;
  title: string;
  category: string;
  department: string;
  location: string;
  status: "Open" | "Assigned" | "In-Progress" | "Resolved";
  upvotes: number;
  upvotedByUserIds: string[];
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebHubPortalRecord {
  id: string;
  name: string;
  category: string;
  ministry: string;
  url: string;
  description: string;
  verifiedOfficial: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentConsentRecord {
  id: string;
  documentId: string;
  ownerUserId: string;
  recipientEntity: string;
  purpose: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  grantedAt: string;
  expiresAt: string;
  revokedAt?: string | null;
}

export interface GovernmentServiceRecord {
  id: string;
  serviceCode: string;
  name: string;
  department: string;
  ministry: string;
  description: string;
  category: string;
  state: string;
  requiredDocumentTypeIds: string[];
  requiredDocuments: string[];
  benefits: string[];
  eligibility: string[];
  slaDays: number;
  fee: number;
  status: "AVAILABLE" | "SANDBOX_PROTOTYPE" | "MAINTENANCE";
  officialPortal: string;
  isPopular?: boolean;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus =
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

export interface GovernmentApplicationRecord {
  id: string;
  applicationNumber: string;
  userId: string;
  serviceId: string;
  status: ApplicationStatus;
  formData: Record<string, any>;
  attachedDocumentIds: string[];
  consentIds: string[];
  trackingToken?: string | null;
  submittedAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationIntegrationRecord {
  id: string;
  applicationId: string;
  providerCode: string;
  idempotencyKey: string;
  correlationId: string;
  status: string;
  trackingToken?: string | null;
  providerReference?: string | null;
  attemptCount: number;
  lastErrorCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  users: UserRecord[];
  profiles: ProfileRecord[];
  roles: RoleRecord[];
  permissions: PermissionRecord[];
  userRoles: { userId: string; roleId: string }[];
  rolePermissions: { roleId: string; permissionId: string }[];
  sessions: SessionRecord[];
  auditEvents: AuditEventRecord[];
  documentTypes: DocumentTypeRecord[];
  citizenDocuments: CitizenDocumentRecord[];
  documentVersions?: DocumentVersionRecord[];
  documentConsents: DocumentConsentRecord[];
  governmentServices: GovernmentServiceRecord[];
  governmentApplications: GovernmentApplicationRecord[];
  applicationIntegrations: ApplicationIntegrationRecord[];
  notifications?: NotificationRecord[];
  feedback?: FeedbackRecord[];
  preferences?: Record<string, UserPreferencesRecord>;
  grievances?: GrievanceRecord[];
  webHubPortals?: WebHubPortalRecord[];
}

const getDataDirectory = () => {
  // A persistent directory is supplied by hosts such as Render. Keeping all
  // mutable demo data below it makes redeploys and restarts safe.
  if (process.env.UGOV_DATA_DIR) {
    return path.resolve(process.env.UGOV_DATA_DIR);
  }
  return path.join(process.cwd(), "storage");
};

const getDbPath = () => {
  if (process.env.UGOV_DATA_DIR) {
    return path.join(getDataDirectory(), "ugov_store.json");
  }
  try {
    if (typeof __dirname !== "undefined") {
      return path.join(__dirname, "ugov_store.json");
    }
    return path.join(path.dirname(fileURLToPath(import.meta.url)), "ugov_store.json");
  } catch {
    return path.join(process.cwd(), "src", "server", "database", "ugov_store.json");
  }
};
const DB_FILE = getDbPath();
const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

class Database {
  private data: DatabaseSchema;

  constructor() {
    // The current metadata engine is a single-process JSON file store.
    // Production must prove that UGOV_DATA_DIR is covered by a writable,
    // dedicated non-root filesystem mount; a path string alone is not proof.
    const storageMode = process.env.UGOV_STORAGE_MODE || (process.env.UGOV_DATA_DIR ? "persistent" : "ephemeral-demo");
    if (process.env.NODE_ENV === "production" && storageMode !== "ephemeral-demo") {
      if (!process.env.UGOV_DATA_DIR) {
        console.warn("[U-GOV STORAGE WARNING] UGOV_DATA_DIR not configured; falling back to local ephemeral storage.");
      } else {
        assertProductionStorageReady(process.env.UGOV_DATA_DIR);
      }
    }
    if (process.env.NODE_ENV === "production" && storageMode === "ephemeral-demo") {
      console.warn("[U-GOV STORAGE WARNING] Running in EPHEMERAL DEMO mode. Uploaded documents and application data can be lost on restart or redeploy. Do not use real citizen data.");
    }
    this.data = this.loadOrInitialize();
  }

  private getDefaultDocumentTypes(): DocumentTypeRecord[] {
    return [
      { id: "AADHAAR", name: "Aadhaar Identity Document", issuingAuthority: "Unique Identification Authority of India (UIDAI)", retentionDays: null },
      { id: "PAN", name: "Permanent Account Number Card", issuingAuthority: "Income Tax Department of India", retentionDays: null },
      { id: "DRIVING_LICENCE", name: "Driving Licence", issuingAuthority: "Ministry of Road Transport & Highways (MoRTH)", retentionDays: 7300 },
      { id: "DOMICILE", name: "State Domicile Certificate", issuingAuthority: "Revenue & Forest Department, Govt of Maharashtra", retentionDays: null },
      { id: "INCOME_CERT", name: "Annual Income Certificate", issuingAuthority: "Tehsildar / Sub-Divisional Officer", retentionDays: 365 },
      { id: "MARKSHEET", name: "Secondary School Marksheet (10th/12th)", issuingAuthority: "State Secondary Education Board", retentionDays: null },
    ];
  }

  private getDefaultGovernmentServices(): GovernmentServiceRecord[] {
    const now = "2026-08-01T00:00:00Z";
    return [
      {
        id: "serv-nsp",
        serviceCode: "NSP",
        name: "National Scholarship Portal (NSP)",
        department: "Department of Higher Education",
        ministry: "Ministry of Education",
        description: "Direct Benefit Transfer (DBT) for pre-matric, post-matric, and merit-based national scholarships for recognized colleges and universities.",
        category: "education",
        state: "ALL_INDIA",
        requiredDocumentTypeIds: ["AADHAAR", "INCOME_CERT", "MARKSHEET"],
        requiredDocuments: [
          "Aadhaar Identity Document",
          "Annual Income Certificate (< 1 year old)",
          "Secondary School Marksheet (10th/12th)",
        ],
        benefits: [
          "100% course tuition fee waiver directly to verified institution",
          "Maintenance allowance up to ₹50,000/year for hostellers",
          "Special incentives for STEM and girl students",
        ],
        eligibility: [
          "Enrolled in a recognized school, college, or university",
          "Annual family income below ₹8 Lakh/year",
          "Minimum 50% marks in previous qualifying examination",
        ],
        slaDays: 21,
        fee: 0,
        status: "AVAILABLE",
        officialPortal: "https://scholarships.gov.in",
        isPopular: true,
        featured: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "serv-parivahan",
        serviceCode: "SARATHI-DL",
        name: "Driving Licence & Learner's Licence (Sarathi)",
        department: "Motor Vehicles Department (RTO)",
        ministry: "Ministry of Road Transport and Highways",
        description: "Application for Learner's Licence, Permanent Driving Licence, slot booking, address renewal, and digital mParivahan credential integration.",
        category: "transport",
        state: "ALL_INDIA",
        requiredDocumentTypeIds: ["AADHAAR", "DOMICILE"],
        requiredDocuments: [
          "Aadhaar Identity Document",
          "State Domicile Certificate",
        ],
        benefits: [
          "Home-based online computer test for Learner's Licence",
          "QR-coded digital Smart Card Driving Licence",
          "Instant nationwide validity under Motor Vehicles Act",
        ],
        eligibility: [
          "Minimum 18 years of age (16 for gearless two-wheelers)",
          "Passed computer-based road safety screening",
        ],
        slaDays: 14,
        fee: 200,
        status: "AVAILABLE",
        officialPortal: "https://sarathi.parivahan.gov.in",
        isPopular: true,
        featured: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "serv-income",
        serviceCode: "INCOME-CERT",
        name: "Annual Income Certificate Issuance",
        department: "Revenue & Forest Department",
        ministry: "Government of Maharashtra",
        description: "Statutory certificate issued by the Sub-Divisional Officer / Tahsildar certifying total annual household income for education concessions and welfare.",
        category: "revenue",
        state: "Maharashtra",
        requiredDocumentTypeIds: ["AADHAAR", "PAN"],
        requiredDocuments: [
          "Aadhaar Identity Document",
          "Permanent Account Number Card",
        ],
        benefits: [
          "Essential prerequisite for fee concessions, scholarships, and EWS quota",
          "Valid across all state higher education institutions and welfare schemes",
        ],
        eligibility: [
          "Resident of Maharashtra with verified local residential record",
          "Submitted self-declaration and employer salary slip or agricultural revenue slip",
        ],
        slaDays: 7,
        fee: 33,
        status: "AVAILABLE",
        officialPortal: "https://aaplesarkar.mahaonline.gov.in",
        isPopular: true,
        featured: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "serv-domicile",
        serviceCode: "DOMICILE-CERT",
        name: "State Domicile & Age-Nationality Certificate",
        department: "District Magistrate Directorate",
        ministry: "State Revenue Department",
        description: "Official statutory certificate proving continuous residency in the state for 15+ years, essential for government job quotas and college admissions.",
        category: "revenue",
        state: "Maharashtra",
        requiredDocumentTypeIds: ["AADHAAR", "MARKSHEET"],
        requiredDocuments: [
          "Aadhaar Identity Document",
          "Secondary School Marksheet (10th/12th)",
        ],
        benefits: [
          "State quota reservation in professional engineering & medical colleges",
          "Eligibility for State Public Service Commission (MPSC) examinations",
        ],
        eligibility: [
          "Continuous residence in Maharashtra for minimum 15 years",
          "Proof of residence or school attendance within the state",
        ],
        slaDays: 15,
        fee: 50,
        status: "AVAILABLE",
        officialPortal: "https://edistrict.gov.in",
        isPopular: true,
        featured: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "serv-kisan",
        serviceCode: "PM-KISAN",
        name: "PM-KISAN Samman Nidhi",
        department: "Department of Agriculture & Farmers Welfare",
        ministry: "Ministry of Agriculture",
        description: "Direct income support of ₹6,000 per year in three equal instalments of ₹2,000 transferred directly into bank accounts of landholding farmer families.",
        category: "agriculture",
        state: "ALL_INDIA",
        requiredDocumentTypeIds: ["AADHAAR"],
        requiredDocuments: [
          "Aadhaar Identity Document",
        ],
        benefits: [
          "₹6,000 annual direct cash transfer via Aadhaar DBT",
          "Seamless integration with Kisan Credit Card (KCC)",
        ],
        eligibility: [
          "Small and marginal farmer families with cultivable landholding",
          "Active Aadhaar e-KYC and land records seeding",
        ],
        slaDays: 14,
        fee: 0,
        status: "AVAILABLE",
        officialPortal: "https://pmkisan.gov.in",
        isPopular: true,
        featured: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "serv-ayushman",
        serviceCode: "AYUSHMAN-CARD",
        name: "Ayushman Bharat PM-JAY Health Coverage",
        department: "National Health Authority",
        ministry: "Ministry of Health and Family Welfare",
        description: "Secondary and tertiary healthcare hospitalisation cover of up to ₹5,00,000 per family per year across 27,000+ empanelled hospitals.",
        category: "healthcare",
        state: "ALL_INDIA",
        requiredDocumentTypeIds: ["AADHAAR", "INCOME_CERT"],
        requiredDocuments: [
          "Aadhaar Identity Document",
          "Annual Income Certificate",
        ],
        benefits: [
          "Cashless and paperless access to healthcare services up to ₹5 Lakhs/year",
          "Covers pre-existing conditions from day one",
        ],
        eligibility: [
          "Families identified in Socio-Economic Caste Census (SECC 2011) or state welfare list",
        ],
        slaDays: 3,
        fee: 0,
        status: "AVAILABLE",
        officialPortal: "https://setu.pmjay.gov.in",
        isPopular: true,
        featured: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private getDefaultGrievances(): GrievanceRecord[] {
    const now = "2026-08-10T09:00:00Z";
    return [
      {
        id: "grv-seed-01",
        ticketId: "GRV-2026-1094",
        ownerUserId: "usr-citizen-01",
        title: "Scholarship Disbursement Status Delay",
        category: "Education & DBT",
        department: "Department of Higher Education",
        location: "Pune District, Maharashtra",
        status: "In-Progress",
        upvotes: 18,
        upvotedByUserIds: [],
        description: "Post-matric scholarship verification completed at college level 18 days ago; bank Aadhaar seeding check still marked pending.",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "grv-seed-02",
        ticketId: "GRV-2026-1142",
        ownerUserId: "usr-citizen-01",
        title: "Streetlight Outage & Ward Drainage Maintenance",
        category: "Urban Civic Infrastructure",
        department: "Municipal Corporation Works",
        location: "Kothrud Ward 14, Pune",
        status: "Assigned",
        upvotes: 34,
        upvotedByUserIds: [],
        description: "Six LED streetlights along Paud Road Feeder Lane 3 are non-functional after heavy rain; citizen safety concern during evening hours.",
        createdAt: "2026-08-12T14:20:00Z",
        updatedAt: "2026-08-12T14:20:00Z",
      },
      {
        id: "grv-seed-03",
        ticketId: "GRV-2026-1208",
        ownerUserId: "usr-citizen-01",
        title: "Delay in Revenue Land Record 7/12 Extract Correction",
        category: "Revenue & Land Records",
        department: "State Revenue & Land Records",
        location: "Haveli Taluka, Pune",
        status: "Open",
        upvotes: 9,
        upvotedByUserIds: [],
        description: "Submitted typographical spelling correction in online Mahabhulekh portal two weeks prior; awaiting Tehsildar digital signature.",
        createdAt: "2026-08-14T11:05:00Z",
        updatedAt: "2026-08-14T11:05:00Z",
      },
    ];
  }

  private getDefaultWebHubPortals(): WebHubPortalRecord[] {
    const now = "2026-08-01T00:00:00Z";
    return [
      {
        id: "hub-india-gov",
        name: "India.gov.in — National Portal of India",
        category: "National Gateway",
        ministry: "Ministry of Electronics & Information Technology",
        url: "https://www.india.gov.in",
        description: "Single-window access to information and services provided by the Indian Government across Central Ministries and States.",
        verifiedOfficial: true,
        isFeatured: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hub-uidai",
        name: "myAadhaar — UIDAI Citizen Services",
        category: "Identity & KYC",
        ministry: "Unique Identification Authority of India",
        url: "https://myaadhaar.uidai.gov.in",
        description: "Update address online, download e-Aadhaar, lock/unlock biometrics, and verify Aadhaar authentication history.",
        verifiedOfficial: true,
        isFeatured: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hub-digilocker",
        name: "DigiLocker National Cloud Vault",
        category: "Identity & KYC",
        ministry: "Digital India Corporation",
        url: "https://www.digilocker.gov.in",
        description: "Access authentic digital certificates, academic marksheets, driving licences, and PAN records issued directly by registrars.",
        verifiedOfficial: true,
        isFeatured: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hub-umang",
        name: "UMANG Unified Mobile Application",
        category: "Citizen Utilities",
        ministry: "Ministry of Electronics & Information Technology",
        url: "https://web.umang.gov.in",
        description: "Unified platform connecting EPFO, CBSE, AICTE, Bharat Gas, e-RaktKosh, and hundreds of state services.",
        verifiedOfficial: true,
        isFeatured: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hub-parivahan",
        name: "Parivahan Sewa & Sarathi",
        category: "Transport & Mobility",
        ministry: "Ministry of Road Transport & Highways",
        url: "https://parivahan.gov.in",
        description: "Vehicle registration (Vahan), Driving Licence services (Sarathi), e-Challan payments, and mParivahan fitness certificates.",
        verifiedOfficial: true,
        isFeatured: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hub-incometax",
        name: "Income Tax e-Filing & PAN Services",
        category: "Tax & Finance",
        ministry: "Central Board of Direct Taxes (CBDT)",
        url: "https://www.incometax.gov.in",
        description: "File Income Tax Returns, link PAN with Aadhaar, view AIS/Form 26AS tax credit statements, and verify refunds.",
        verifiedOfficial: true,
        isFeatured: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hub-passport",
        name: "Passport Seva Kendra Portal",
        category: "Identity & KYC",
        ministry: "Ministry of External Affairs",
        url: "https://www.passportindia.gov.in",
        description: "Apply for fresh or reissue Indian passports, schedule PSK appointments, and track police verification status.",
        verifiedOfficial: true,
        isFeatured: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hub-nsp",
        name: "National Scholarship Portal (NSP)",
        category: "Education & Welfare",
        ministry: "Ministry of Electronics & Information Technology",
        url: "https://scholarships.gov.in",
        description: "One-stop Direct Benefit Transfer portal for pre-matric, post-matric, and merit-cum-means student scholarships.",
        verifiedOfficial: true,
        isFeatured: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hub-pmjay",
        name: "Ayushman Bharat — PM-JAY Beneficiary Portal",
        category: "Healthcare",
        ministry: "National Health Authority",
        url: "https://beneficiary.nha.gov.in",
        description: "Check family eligibility, download Ayushman health card, and locate empanelled cashless hospitals across India.",
        verifiedOfficial: true,
        isFeatured: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "hub-cpgrams",
        name: "CPGRAMS — Public Grievance Redressal",
        category: "Citizen Utilities",
        ministry: "Department of Administrative Reforms & Public Grievances",
        url: "https://pgportal.gov.in",
        description: "Official central portal for lodging and tracking grievances against Central and State Government ministries.",
        verifiedOfficial: true,
        isFeatured: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private seedDefaultCitizenDocuments(citizenUserId: string): {
    documents: CitizenDocumentRecord[];
    consents: DocumentConsentRecord[];
  } {
    try {
      const vaultDir = path.join(getDataDirectory(), "vault");
      if (!fs.existsSync(vaultDir)) {
        fs.mkdirSync(vaultDir, { recursive: true, mode: 0o700 });
      }

      // 1. Seed Aadhaar Document
      const aadhaarKey = crypto.randomUUID();
      const aadhaarBuf = Buffer.from(
        "%PDF-1.4\n%Official Aadhaar Identity Card - Government of India\nUIDAI Verified Cryptographic Seed Credential\n%%EOF"
      );
      const aadhaarSha = crypto.createHash("sha256").update(aadhaarBuf).digest("hex");
      fs.writeFileSync(path.join(vaultDir, aadhaarKey), aadhaarBuf, { mode: 0o600 });

      const aadhaarDoc: CitizenDocumentRecord = {
        id: "doc-seed-aadhaar",
        ownerUserId: citizenUserId,
        documentTypeId: "AADHAAR",
        title: "Aadhaar Identity Card",
        documentNumber: "XXXX-XXXX-9012",
        fileName: "aadhaar_identity_card.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: aadhaarBuf.length,
        storageKey: aadhaarKey,
        sha256Checksum: aadhaarSha,
        verificationStatus: "SELF_ATTESTED",
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      };

      // 2. Seed Income Certificate
      const incomeKey = crypto.randomUUID();
      const incomeBuf = Buffer.from(
        "%PDF-1.4\n%Revenue Department Tahsildar Office Annual Income Certificate 2026-27\nState Government Seed Credential\n%%EOF"
      );
      const incomeSha = crypto.createHash("sha256").update(incomeBuf).digest("hex");
      fs.writeFileSync(path.join(vaultDir, incomeKey), incomeBuf, { mode: 0o600 });

      const incomeDoc: CitizenDocumentRecord = {
        id: "doc-seed-income",
        ownerUserId: citizenUserId,
        documentTypeId: "INCOME_CERT",
        title: "Annual Income Certificate",
        documentNumber: "INC-2026-78129",
        fileName: "income_certificate.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: incomeBuf.length,
        storageKey: incomeKey,
        sha256Checksum: incomeSha,
        verificationStatus: "SELF_ATTESTED",
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      };

      // 3. Seed Active Consent
      const consentRecord: DocumentConsentRecord = {
        id: "cst-seed-01",
        documentId: "doc-seed-income",
        ownerUserId: citizenUserId,
        recipientEntity: "Department of Higher Education (NSP Portal)",
        purpose: "Post-Matric Scholarship Eligibility Verification",
        status: "ACTIVE",
        grantedAt: "2026-08-15T00:00:00Z",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      return {
        documents: [aadhaarDoc, incomeDoc],
        consents: [consentRecord],
      };
    } catch (e) {
      console.warn("Could not seed default documents to vault disk:", e);
      return { documents: [], consents: [] };
    }
  }

  private ensureSeedVaultFiles(snapshot: DatabaseSchema): void {
    try {
      const vaultDir = path.join(getDataDirectory(), "vault");
      const seedBodies: Record<string, Buffer> = {
        "doc-seed-aadhaar": Buffer.from(
          "%PDF-1.4\n%Official Aadhaar Identity Card - Government of India\nUIDAI Verified Cryptographic Seed Credential\n%%EOF"
        ),
        "doc-seed-income": Buffer.from(
          "%PDF-1.4\n%Revenue Department Tahsildar Office Annual Income Certificate 2026-27\nState Government Seed Credential\n%%EOF"
        ),
      };

      for (const doc of snapshot.citizenDocuments || []) {
        const seedBuffer = seedBodies[doc.id];
        if (!seedBuffer) continue;
        if (!/^[0-9a-f-]{36}$/i.test(doc.storageKey)) continue;
        const expectedSha = crypto.createHash("sha256").update(seedBuffer).digest("hex");
        if (doc.sha256Checksum !== expectedSha) continue;

        const targetPath = path.join(vaultDir, path.basename(doc.storageKey));
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(vaultDir, { recursive: true, mode: 0o700 });
          fs.writeFileSync(targetPath, seedBuffer, { mode: 0o600 });
        }
      }
    } catch (err) {
      console.warn("Could not restore deterministic seed vault files:", err);
    }
  }

  private writeSnapshotAtomically(snapshot: DatabaseSchema): void {
    const directory = path.dirname(DB_FILE);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporaryFile = `${DB_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
    let descriptor: number | undefined;

    try {
      descriptor = fs.openSync(temporaryFile, "wx", 0o600);
      fs.writeFileSync(descriptor, JSON.stringify(snapshot, null, 2), "utf-8");
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      fs.renameSync(temporaryFile, DB_FILE);

      // Sync the containing directory so the rename itself is durable on
      // filesystems that support directory fsync.
      let directoryDescriptor: number | undefined;
      try {
        directoryDescriptor = fs.openSync(directory, "r");
        fs.fsyncSync(directoryDescriptor);
      } catch {
        // Some platforms/filesystems do not allow fsync on directory handles.
      } finally {
        if (directoryDescriptor !== undefined) {
          try { fs.closeSync(directoryDescriptor); } catch { /* best effort */ }
        }
      }
    } catch (error) {
      if (descriptor !== undefined) {
        try { fs.closeSync(descriptor); } catch { /* best effort */ }
      }
      try { if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile); } catch { /* best effort */ }
      throw error;
    }
  }

  private loadOrInitialize(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed: DatabaseSchema = JSON.parse(raw);
        if (!parsed.documentTypes || parsed.documentTypes.length === 0) {
          parsed.documentTypes = this.getDefaultDocumentTypes();
        }
        // An intentionally empty vault is valid; never recreate sample documents
        // after a citizen has deleted their final document.
        if (!parsed.citizenDocuments) parsed.citizenDocuments = [];
        if (!parsed.documentConsents) parsed.documentConsents = [];
        if (!parsed.governmentServices || parsed.governmentServices.length === 0) {
          parsed.governmentServices = this.getDefaultGovernmentServices();
        }
        if (!parsed.governmentApplications) parsed.governmentApplications = [];
        if (!parsed.applicationIntegrations) parsed.applicationIntegrations = [];
        if (!parsed.documentVersions) parsed.documentVersions = [];
        if (!parsed.notifications) parsed.notifications = [];
        if (!parsed.feedback) parsed.feedback = [];
        if (!parsed.preferences) parsed.preferences = {};
        if (!parsed.grievances || parsed.grievances.length === 0) {
          parsed.grievances = this.getDefaultGrievances();
        }
        if (!parsed.webHubPortals || parsed.webHubPortals.length === 0) {
          parsed.webHubPortals = this.getDefaultWebHubPortals();
        }

        // Auto-migrate the existing demo user's name if they have the old name in the persistent DB
        if (parsed.profiles) {
          const demoProfile = parsed.profiles.find((p) => p.userId === "usr-citizen-01");
          if (demoProfile && demoProfile.displayName.toLowerCase().includes("ganesh") || (demoProfile && demoProfile.displayName === "TEJAS GAVADE")) {
            demoProfile.displayName = "Tejas Gavade";
            
            // Also write the update back to the persistent disk right away
            try {
              this.writeSnapshotAtomically(parsed);
            } catch (e) {
              console.warn("Failed to save migrated name to disk:", e);
            }
          }
        }

        this.ensureSeedVaultFiles(parsed);
        return parsed;
      }
    } catch (err) {
      // Never replace an unreadable existing store with demo seed data.
      if (fs.existsSync(DB_FILE)) {
        throw new Error("U-GOV data store could not be read safely. Startup stopped to prevent data loss.");
      }
      throw err;
    }
    return this.initializeSeed();
  }

  private save(): void {
    try {
      this.writeSnapshotAtomically(this.data);
    } catch (err) {
      console.error("Failed to write to database file:", err);
      throw new Error("U-GOV data store write failed; the requested change was not confirmed.");
    }
  }

  private initializeSeed(): DatabaseSchema {
    const citizenPw = hashPassword("Citizen@UGov2026");
    const adminPw = hashPassword("Admin@UGov2026");
    const auditorPw = hashPassword("Auditor@UGov2026");

    const citizenUserId = "usr-citizen-01";
    const adminUserId = "usr-admin-01";
    const auditorUserId = "usr-auditor-01";
    // Seed once so document metadata and consent reference the same vault files.
    const seededCitizenData = this.seedDefaultCitizenDocuments(citizenUserId);

    const initialDb: DatabaseSchema = {
      users: [
        {
          id: citizenUserId,
          identifier: "citizen@u-gov.gov.in",
          passwordHash: citizenPw.hash,
          salt: citizenPw.salt,
          status: "ACTIVE",
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
        {
          id: adminUserId,
          identifier: "admin@u-gov.gov.in",
          passwordHash: adminPw.hash,
          salt: adminPw.salt,
          status: "ACTIVE",
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
        {
          id: auditorUserId,
          identifier: "auditor@u-gov.gov.in",
          passwordHash: auditorPw.hash,
          salt: auditorPw.salt,
          status: "ACTIVE",
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
      ],
      profiles: [
        {
          id: "prof-01",
          userId: citizenUserId,
          displayName: "Tejas Gavade",
          phone: "+91 98234 56789",
          preferredLanguage: "en",
          kycLevel: "Tier 4 (Sovereign Full-KYC)",
          aadhaarLinked: true,
          panLinked: true,
          state: "Maharashtra",
          district: "Pune",
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
        {
          id: "prof-02",
          userId: adminUserId,
          displayName: "System Administrator",
          phone: "+91 98000 00001",
          preferredLanguage: "en",
          kycLevel: "Tier 4 (Sovereign Full-KYC)",
          aadhaarLinked: true,
          panLinked: true,
          state: "Maharashtra",
          district: "Central Operations",
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
        {
          id: "prof-03",
          userId: auditorUserId,
          displayName: "Statutory Compliance Officer",
          phone: "+91 98000 00002",
          preferredLanguage: "en",
          kycLevel: "Tier 3 (High-Assurance)",
          aadhaarLinked: true,
          panLinked: true,
          state: "Maharashtra",
          district: "Audit Directorate",
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
      ],
      roles: [
        { id: "CITIZEN", name: "Citizen", description: "Standard citizen account with access to public services and DigiVault" },
        { id: "OFFICIAL", name: "Department Officer", description: "Officer desk access for verifying and processing applications" },
        { id: "ADMIN", name: "System Administrator", description: "Full platform operational governance and telemetry" },
        { id: "AUDITOR", name: "Statutory Auditor", description: "Read-only access to tamper-evident system audit logs" },
      ],
      permissions: [
        { id: "services:read", name: "Read Services", description: "Browse public services catalogue" },
        { id: "services:apply", name: "Apply for Services", description: "Submit applications for public services" },
        { id: "documents:manage", name: "Manage DigiVault", description: "Upload and manage credentials" },
        { id: "applications:read", name: "Track Applications", description: "View application status" },
        { id: "audit:read", name: "Read Audit Logs", description: "Inspect tamper-evident system event ledger" },
        { id: "system:admin", name: "Admin Console", description: "Full telemetry and configuration" },
      ],
      userRoles: [
        { userId: citizenUserId, roleId: "CITIZEN" },
        { userId: adminUserId, roleId: "ADMIN" },
        { userId: auditorUserId, roleId: "AUDITOR" },
      ],
      rolePermissions: [
        { roleId: "CITIZEN", permissionId: "services:read" },
        { roleId: "CITIZEN", permissionId: "services:apply" },
        { roleId: "CITIZEN", permissionId: "documents:manage" },
        { roleId: "CITIZEN", permissionId: "applications:read" },
        { roleId: "ADMIN", permissionId: "system:admin" },
        { roleId: "ADMIN", permissionId: "audit:read" },
        { roleId: "AUDITOR", permissionId: "audit:read" },
      ],
      sessions: [],
      auditEvents: [
        (() => {
          const seedTimestamp = new Date().toISOString();
          return {
            id: "aud-seed-01",
            timestamp: seedTimestamp,
            actorId: "SYSTEM",
            actorName: "U-GOV Core Gateway",
            actorRole: "System Node",
            action: "SYSTEM_INITIALIZATION",
            resource: "U-IDENTITY Store",
            result: "SUCCESS" as const,
            context: "Seeded initial sovereign roles, permissions, and baseline cryptographic entities",
            prevHash: GENESIS_HASH,
            hash: computeAuditHash(
              GENESIS_HASH,
              `${seedTimestamp}|SYSTEM|U-GOV Core Gateway|SYSTEM_INITIALIZATION|U-IDENTITY Store|SUCCESS|Seeded initial sovereign roles, permissions, and baseline cryptographic entities`
            ),
          };
        })(),
      ],
      documentTypes: this.getDefaultDocumentTypes(),
      citizenDocuments: seededCitizenData.documents,
      documentVersions: [],
      documentConsents: seededCitizenData.consents,
      governmentServices: this.getDefaultGovernmentServices(),
      governmentApplications: [],
      applicationIntegrations: [],
      notifications: [],
      feedback: [],
      preferences: {},
      grievances: this.getDefaultGrievances(),
      webHubPortals: this.getDefaultWebHubPortals(),
    };

    try {
      this.writeSnapshotAtomically(initialDb);
    } catch (e) {
      throw new Error("U-GOV could not initialize its data store; startup stopped rather than running without persistence.");
    }

    return initialDb;
  }

  // --- Users & Profiles ---

  public findUserByIdentifier(identifier: string): UserRecord | undefined {
    const clean = identifier.toLowerCase().trim();
    return this.data.users.find((u) => u.identifier.toLowerCase() === clean);
  }

  public findUserByGoogleSub(googleSub: string): UserRecord | undefined {
    return this.data.users.find((u) => u.googleSub === googleSub);
  }

  public findUserById(id: string): UserRecord | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getProfileByUserId(userId: string): ProfileRecord | undefined {
    return this.data.profiles.find((p) => p.userId === userId);
  }

  public createUser(user: UserRecord, profile: ProfileRecord, roleId: string = "CITIZEN"): void {
    this.data.users.push(user);
    this.data.profiles.push(profile);
    this.data.userRoles.push({ userId: user.id, roleId });
    this.save();
  }

  public updateUser(id: string, updates: Partial<UserRecord>): void {
    const index = this.data.users.findIndex((u) => u.id === id);
    if (index !== -1) {
      this.data.users[index] = { ...this.data.users[index], ...updates, updatedAt: new Date().toISOString() };
      this.save();
    }
  }

  public updateProfile(userId: string, updates: Partial<ProfileRecord>): void {
    const index = this.data.profiles.findIndex((p) => p.userId === userId);
    if (index !== -1) {
      this.data.profiles[index] = { ...this.data.profiles[index], ...updates, updatedAt: new Date().toISOString() };
      this.save();
    }
  }

  // --- Roles & Permissions ---

  public getUserRoles(userId: string): RoleRecord[] {
    const roleIds = this.data.userRoles.filter((ur) => ur.userId === userId).map((ur) => ur.roleId);
    return this.data.roles.filter((r) => roleIds.includes(r.id));
  }

  public getUserPermissions(userId: string): string[] {
    const roleIds = this.data.userRoles.filter((ur) => ur.userId === userId).map((ur) => ur.roleId);
    const permIds = this.data.rolePermissions
      .filter((rp) => roleIds.includes(rp.roleId))
      .map((rp) => rp.permissionId);
    return Array.from(new Set(permIds));
  }

  // --- Sessions ---

  public createSession(session: SessionRecord): void {
    const existingIndex = this.data.sessions.findIndex((s) => s.id === session.id);
    if (existingIndex !== -1) {
      this.data.sessions[existingIndex] = session;
    } else {
      this.data.sessions.push(session);
    }
    this.save();
  }

  public findSessionByHash(tokenHash: string): SessionRecord | undefined {
    const now = new Date().toISOString();
    return this.data.sessions.find(
      (s) => s.tokenHash === tokenHash && !s.revokedAt && s.expiresAt > now
    );
  }

  public revokeSession(sessionId: string): void {
    const now = new Date().toISOString();
    let updated = false;
    this.data.sessions.forEach((s) => {
      if (s.id === sessionId) {
        s.revokedAt = now;
        updated = true;
      }
    });
    if (updated) {
      this.save();
    }
  }

  public getSessionsByUser(userId: string): SessionRecord[] {
    const now = new Date().toISOString();
    return (this.data.sessions || [])
      .filter((s) => s.userId === userId && s.expiresAt > now)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public findSessionById(sessionId: string): SessionRecord | undefined {
    return (this.data.sessions || []).find((s) => s.id === sessionId);
  }

  public revokeAllUserSessions(userId: string): void {
    const now = new Date().toISOString();
    this.data.sessions.forEach((s) => {
      if (s.userId === userId && !s.revokedAt) {
        s.revokedAt = now;
      }
    });
    this.save();
  }

  // --- Audit Events ---

  public recordAuditEvent(event: AuditEventRecord): void {
    const lastEvent = this.data.auditEvents[this.data.auditEvents.length - 1];
    const prevHash = lastEvent?.hash || GENESIS_HASH;
    const canonicalData = `${event.timestamp}|${event.actorId || ""}|${event.actorName}|${event.action}|${event.resource}|${event.result}|${event.context}`;
    event.prevHash = prevHash;
    event.hash = computeAuditHash(prevHash, canonicalData);

    this.data.auditEvents.push(event);
    if (this.data.auditEvents.length > 50000) {
      const archiveCount = 25000;
      const archivedSlice = this.data.auditEvents.slice(0, archiveCount);
      const lastArchived = archivedSlice[archivedSlice.length - 1];
      const remainder = this.data.auditEvents.slice(archiveCount);
      try {
        const archiveDir = path.dirname(DB_FILE);
        const archivePath = path.join(archiveDir, `ugov_audit_archive_${Date.now()}.json`);
        fs.writeFileSync(archivePath, JSON.stringify(archivedSlice, null, 2), { mode: 0o600 });
      } catch (err) {
        console.warn("Failed to archive older audit segment:", err);
      }
      // Keep the remaining chain anchored cleanly so verifyAuditLedger remains intact
      if (lastArchived?.hash && remainder.length > 0 && !remainder[0].prevHash) {
        remainder[0].prevHash = lastArchived.hash;
      }
      this.data.auditEvents = remainder;
    }
    this.save();
  }

  public insertAuditEvent(event: Omit<AuditEventRecord, "id" | "timestamp"> & { id?: string; timestamp?: string }): void {
    this.recordAuditEvent({
      id: event.id || `aud-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: event.timestamp || new Date().toISOString(),
      actorId: event.actorId,
      actorName: event.actorName,
      actorRole: event.actorRole,
      action: event.action,
      resource: event.resource,
      result: event.result,
      context: event.context,
      ipAddress: event.ipAddress,
    });
  }

  public getAuditEvents(limit: number = 50, offset: number = 0): AuditEventRecord[] {
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.max(1, Math.min(limit, 500));
    return [...this.data.auditEvents].reverse().slice(safeOffset, safeOffset + safeLimit);
  }

  public getAuditEventsCount(): number {
    return this.data.auditEvents.length;
  }

  public verifyAuditLedger(): { valid: boolean; totalEvents: number; brokenIndex?: number; brokenEventId?: string } {
    if (!this.data.auditEvents || this.data.auditEvents.length === 0) {
      return { valid: true, totalEvents: 0 };
    }

    let expectedPrevHash = this.data.auditEvents[0].prevHash || GENESIS_HASH;
    for (let i = 0; i < this.data.auditEvents.length; i++) {
      const e = this.data.auditEvents[i];
      if (e.prevHash && e.prevHash !== expectedPrevHash) {
        return { valid: false, totalEvents: this.data.auditEvents.length, brokenIndex: i, brokenEventId: e.id };
      }
      const canonicalData = `${e.timestamp}|${e.actorId || ""}|${e.actorName}|${e.action}|${e.resource}|${e.result}|${e.context}`;
      const calculatedHash = computeAuditHash(expectedPrevHash, canonicalData);
      if (e.hash && e.hash !== calculatedHash) {
        return { valid: false, totalEvents: this.data.auditEvents.length, brokenIndex: i, brokenEventId: e.id };
      }
      if (e.hash) {
        expectedPrevHash = e.hash;
      }
    }
    return { valid: true, totalEvents: this.data.auditEvents.length };
  }

  // --- U-DOCS Document Types ---

  public getDocumentTypes(): DocumentTypeRecord[] {
    return this.data.documentTypes || [];
  }

  public findDocumentTypeById(id: string): DocumentTypeRecord | undefined {
    return (this.data.documentTypes || []).find((dt) => dt.id === id);
  }

  // --- U-DOCS Citizen Documents ---

  public getDocumentsByOwner(ownerUserId: string): CitizenDocumentRecord[] {
    return (this.data.citizenDocuments || []).filter((d) => d.ownerUserId === ownerUserId);
  }

  public findDocumentById(id: string): CitizenDocumentRecord | undefined {
    return (this.data.citizenDocuments || []).find((d) => d.id === id);
  }

  public createDocument(doc: CitizenDocumentRecord): void {
    if (!this.data.citizenDocuments) {
      this.data.citizenDocuments = [];
    }
    this.data.citizenDocuments.push(doc);
    try {
      this.save();
    } catch (error) {
      this.data.citizenDocuments = this.data.citizenDocuments.filter((item) => item.id !== doc.id);
      throw error;
    }
  }

  public updateDocument(id: string, updates: Partial<CitizenDocumentRecord>): void {
    const index = (this.data.citizenDocuments || []).findIndex((d) => d.id === id);
    if (index !== -1) {
      const previous = this.data.citizenDocuments[index];
      this.data.citizenDocuments[index] = {
        ...previous,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      try {
        this.save();
      } catch (error) {
        this.data.citizenDocuments[index] = previous;
        throw error;
      }
    }
  }

  public deleteDocument(id: string): boolean {
    const initialLen = (this.data.citizenDocuments || []).length;
    const previousDocuments = this.data.citizenDocuments || [];
    const previousConsents = this.data.documentConsents || [];
    this.data.citizenDocuments = previousDocuments.filter((d) => d.id !== id);
    this.data.documentConsents = previousConsents.filter((c) => c.documentId !== id);
    const deleted = this.data.citizenDocuments.length < initialLen;
    if (deleted) {
      try {
        this.save();
      } catch (error) {
        this.data.citizenDocuments = previousDocuments;
        this.data.documentConsents = previousConsents;
        throw error;
      }
    }
    return deleted;
  }

  // --- U-DOCS Document Consents ---

  public createConsent(consent: DocumentConsentRecord): void {
    if (!this.data.documentConsents) {
      this.data.documentConsents = [];
    }
    this.data.documentConsents.push(consent);
    try {
      this.save();
    } catch (error) {
      this.data.documentConsents = this.data.documentConsents.filter((item) => item.id !== consent.id);
      throw error;
    }
  }

  private expireElapsedConsents(): void {
    const now = new Date().toISOString();
    let changed = false;
    for (const consent of this.data.documentConsents || []) {
      if (consent.status === "ACTIVE" && consent.expiresAt <= now) {
        consent.status = "EXPIRED";
        changed = true;
      }
    }
    if (changed) this.save();
  }

  public getConsentsByDocumentId(documentId: string): DocumentConsentRecord[] {
    this.expireElapsedConsents();
    return (this.data.documentConsents || []).filter((c) => c.documentId === documentId);
  }

  public getConsentsByOwner(ownerUserId: string): DocumentConsentRecord[] {
    this.expireElapsedConsents();
    return (this.data.documentConsents || []).filter((c) => c.ownerUserId === ownerUserId);
  }

  public findConsentById(consentId: string): DocumentConsentRecord | undefined {
    return (this.data.documentConsents || []).find((c) => c.id === consentId);
  }

  public revokeConsent(consentId: string, ownerUserId: string): boolean {
    const consent = (this.data.documentConsents || []).find(
      (c) => c.id === consentId && c.ownerUserId === ownerUserId
    );
    if (consent && consent.status === "ACTIVE") {
      const previousStatus = consent.status;
      const previousRevokedAt = consent.revokedAt;
      consent.status = "REVOKED";
      consent.revokedAt = new Date().toISOString();
      try {
        this.save();
      } catch (error) {
        consent.status = previousStatus;
        consent.revokedAt = previousRevokedAt;
        throw error;
      }
      return true;
    }
    return false;
  }

  public checkActiveConsent(documentId: string, recipientEntity: string): DocumentConsentRecord | undefined {
    this.expireElapsedConsents();
    const now = new Date().toISOString();
    return (this.data.documentConsents || []).find(
      (c) =>
        c.documentId === documentId &&
        c.recipientEntity.toLowerCase() === recipientEntity.toLowerCase() &&
        c.status === "ACTIVE" &&
        c.expiresAt > now
    );
  }

  // --- U-SERVICES Public Service Catalogue ---

  public getServices(category?: string, query?: string, state?: string): GovernmentServiceRecord[] {
    let list = this.data.governmentServices || [];
    if (category && category !== "all") {
      const cleanCat = category.toLowerCase().trim();
      list = list.filter((s) => s.category.toLowerCase() === cleanCat);
    }
    if (state && state !== "ALL") {
      const cleanState = state.toLowerCase().trim();
      list = list.filter((s) => s.state === "ALL_INDIA" || s.state.toLowerCase() === cleanState);
    }
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.serviceCode.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q)
      );
    }
    return list;
  }

  public findServiceById(id: string): GovernmentServiceRecord | undefined {
    return (this.data.governmentServices || []).find((s) => s.id === id);
  }

  public findServiceByCode(code: string): GovernmentServiceRecord | undefined {
    const clean = code.toUpperCase().trim();
    return (this.data.governmentServices || []).find((s) => s.serviceCode.toUpperCase() === clean);
  }

  public createService(service: GovernmentServiceRecord): void {
    if (!this.data.governmentServices) this.data.governmentServices = [];
    this.data.governmentServices.push(service);
    this.save();
  }

  public updateService(id: string, updates: Partial<GovernmentServiceRecord>): void {
    const s = this.findServiceById(id);
    if (s) {
      Object.assign(s, updates, { updatedAt: new Date().toISOString() });
      this.save();
    }
  }

  public getAllApplications(): GovernmentApplicationRecord[] {
    return this.data.governmentApplications || [];
  }

  public getApplications(userId?: string): GovernmentApplicationRecord[] {
    if (userId) {
      return this.getApplicationsByOwner(userId);
    }
    return this.data.governmentApplications || [];
  }

  public getApplicationsByOwner(userId: string): GovernmentApplicationRecord[] {
    return (this.data.governmentApplications || [])
      .filter((app) => app.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public findApplicationById(id: string): GovernmentApplicationRecord | undefined {
    return (this.data.governmentApplications || []).find((app) => app.id === id);
  }

  public findApplicationByNumber(applicationNumber: string): GovernmentApplicationRecord | undefined {
    const clean = applicationNumber.toUpperCase().trim();
    return (this.data.governmentApplications || []).find((app) => app.applicationNumber.toUpperCase() === clean);
  }

  public createApplication(app: GovernmentApplicationRecord): void {
    if (!this.data.governmentApplications) this.data.governmentApplications = [];
    this.data.governmentApplications.push(app);
    this.save();
  }

  public updateApplication(id: string, updates: Partial<GovernmentApplicationRecord>): void {
    const app = this.findApplicationById(id);
    if (app) {
      Object.assign(app, updates, { updatedAt: new Date().toISOString() });
      this.save();
    }
  }

  public deleteApplication(id: string): void {
    if (this.data.governmentApplications) {
      this.data.governmentApplications = this.data.governmentApplications.filter((app) => app.id !== id);
      this.save();
    }
  }

  // --- U-INTEGRATIONS Store & Telemetry (Phase 5) ---

  public findIntegrationByApplicationId(applicationId: string): ApplicationIntegrationRecord | undefined {
    return (this.data.applicationIntegrations || []).find((i) => i.applicationId === applicationId);
  }

  public findIntegrationByIdempotencyKey(key: string): ApplicationIntegrationRecord | undefined {
    return (this.data.applicationIntegrations || []).find((i) => i.idempotencyKey === key);
  }

  public findIntegrationByCorrelationId(correlationId: string): ApplicationIntegrationRecord | undefined {
    return (this.data.applicationIntegrations || []).find((i) => i.correlationId === correlationId);
  }

  public recordIntegrationAttempt(record: ApplicationIntegrationRecord): void {
    if (!this.data.applicationIntegrations) this.data.applicationIntegrations = [];
    const existingIndex = this.data.applicationIntegrations.findIndex(
      (i) => i.idempotencyKey === record.idempotencyKey || i.id === record.id
    );

    if (existingIndex !== -1) {
      this.data.applicationIntegrations[existingIndex] = {
        ...this.data.applicationIntegrations[existingIndex],
        ...record,
        updatedAt: new Date().toISOString(),
      };
    } else {
      this.data.applicationIntegrations.push(record);
    }
    this.save();
  }

  public updateIntegrationStatus(
    applicationId: string,
    status: string,
    lastErrorCode?: string | null
  ): void {
    const integration = this.findIntegrationByApplicationId(applicationId);
    if (integration) {
      integration.status = status;
      if (lastErrorCode !== undefined) {
        integration.lastErrorCode = lastErrorCode;
      }
      integration.updatedAt = new Date().toISOString();
      this.save();
    }
  }

  // --- Document Versioning ---

  public getDocumentVersions(documentId: string): DocumentVersionRecord[] {
    return (this.data.documentVersions || [])
      .filter((v) => v.documentId === documentId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  public addDocumentVersion(version: DocumentVersionRecord): void {
    if (!this.data.documentVersions) this.data.documentVersions = [];
    this.data.documentVersions.push(version);
    this.save();
  }

  // --- Persistent Notifications ---

  public getNotificationsByUser(userId: string): NotificationRecord[] {
    if (!this.data.notifications) this.data.notifications = [];
    const userNotifs = this.data.notifications.filter((n) => n.userId === userId);
    if (userNotifs.length === 0) {
      const now = Date.now();
      const seeded: NotificationRecord[] = [
        {
          id: `notif-seed-1-${crypto.randomUUID()}`,
          userId,
          title: "Welcome to U-GOV",
          message: "Your citizen workspace is ready. Explore services, manage documents, and apply for schemes.",
          type: "info",
          priority: "normal",
          read: false,
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: `notif-seed-2-${crypto.randomUUID()}`,
          userId,
          title: "Consent Expiry Reminder",
          message: "Review active DPDP consent grants in Consent Center to ensure only authorized portals retain access.",
          type: "warning",
          priority: "high",
          read: false,
          relatedRef: "cst-seed-01",
          createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: `notif-seed-3-${crypto.randomUUID()}`,
          userId,
          title: "G-Bot AI Assistant Activated",
          message: "Bharat G-Bot is available to help you navigate services, check readiness, and explain government terminology.",
          type: "success",
          priority: "low",
          read: true,
          createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
        },
      ];
      this.data.notifications.push(...seeded);
      this.save();
      return seeded;
    }
    return userNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addNotification(notification: NotificationRecord): void {
    if (!this.data.notifications) this.data.notifications = [];
    this.data.notifications.unshift(notification);
    // Keep at most 100 notifications per citizen
    let count = 0;
    this.data.notifications = this.data.notifications.filter((n) => {
      if (n.userId !== notification.userId) return true;
      count++;
      return count <= 100;
    });
    this.save();
  }

  public markNotificationRead(id: string, userId: string): boolean {
    const item = (this.data.notifications || []).find((n) => n.id === id && n.userId === userId);
    if (!item) return false;
    item.read = true;
    this.save();
    return true;
  }

  public markAllNotificationsRead(userId: string): void {
    let changed = false;
    for (const item of this.data.notifications || []) {
      if (item.userId === userId && !item.read) {
        item.read = true;
        changed = true;
      }
    }
    if (changed) this.save();
  }

  public deleteNotification(id: string, userId: string): boolean {
    if (!this.data.notifications) return false;
    const before = this.data.notifications.length;
    this.data.notifications = this.data.notifications.filter((n) => !(n.id === id && n.userId === userId));
    const removed = this.data.notifications.length < before;
    if (removed) this.save();
    return removed;
  }

  // --- Persistent Feedback ---

  public getFeedbackByUser(userId: string): FeedbackRecord[] {
    return (this.data.feedback || [])
      .filter((f) => f.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getAllFeedback(): FeedbackRecord[] {
    return this.data.feedback || [];
  }

  public addFeedback(record: FeedbackRecord): void {
    if (!this.data.feedback) this.data.feedback = [];
    this.data.feedback.push(record);
    this.save();
  }

  // --- Persistent Preferences ---

  public getUserPreferences(userId: string): Partial<UserPreferencesRecord> {
    if (!this.data.preferences) return {};
    return this.data.preferences[userId] || {};
  }

  public updateUserPreferences(userId: string, updates: Partial<UserPreferencesRecord>): UserPreferencesRecord {
    if (!this.data.preferences) this.data.preferences = {};
    const existing = this.data.preferences[userId] || { userId, updatedAt: new Date().toISOString() };
    const merged: UserPreferencesRecord = {
      ...existing,
      ...updates,
      userId,
      updatedAt: new Date().toISOString(),
    };
    this.data.preferences[userId] = merged;
    this.save();
    return merged;
  }

  // --- Persistent Grievances ---

  public getGrievances(status?: string): GrievanceRecord[] {
    let list = this.data.grievances || [];
    if (status && status !== "All") {
      list = list.filter((g) => g.status === status);
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public findGrievanceById(id: string): GrievanceRecord | undefined {
    return (this.data.grievances || []).find((g) => g.id === id);
  }

  public createGrievance(record: GrievanceRecord): void {
    if (!this.data.grievances) this.data.grievances = [];
    this.data.grievances.unshift(record);
    this.save();
  }

  public toggleGrievanceUpvote(id: string, userId: string): GrievanceRecord | undefined {
    const grv = this.findGrievanceById(id);
    if (!grv) return undefined;
    if (!grv.upvotedByUserIds) grv.upvotedByUserIds = [];
    const idx = grv.upvotedByUserIds.indexOf(userId);
    if (idx === -1) {
      grv.upvotedByUserIds.push(userId);
      grv.upvotes += 1;
    } else {
      grv.upvotedByUserIds.splice(idx, 1);
      grv.upvotes = Math.max(0, grv.upvotes - 1);
    }
    grv.updatedAt = new Date().toISOString();
    this.save();
    return grv;
  }

  // --- Persistent Government Web Hub Directory ---

  public getWebHubPortals(category?: string, query?: string): WebHubPortalRecord[] {
    let list = this.data.webHubPortals || [];
    if (category && category !== "all") {
      const catClean = category.toLowerCase().trim();
      list = list.filter((p) => p.category.toLowerCase() === catClean);
    }
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.ministry.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.url.toLowerCase().includes(q)
      );
    }
    return list;
  }

  public findWebHubPortalById(id: string): WebHubPortalRecord | undefined {
    return (this.data.webHubPortals || []).find((p) => p.id === id);
  }

  public createWebHubPortal(portal: WebHubPortalRecord): void {
    if (!this.data.webHubPortals) this.data.webHubPortals = [];
    this.data.webHubPortals.unshift(portal);
    this.save();
  }

  public updateWebHubPortal(id: string, updates: Partial<WebHubPortalRecord>): WebHubPortalRecord | undefined {
    const portal = this.findWebHubPortalById(id);
    if (!portal) return undefined;
    Object.assign(portal, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return portal;
  }
}

export const db = new Database();
