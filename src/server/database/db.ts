import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { hashPassword, computeAuditHash } from "../auth/crypto";

export interface UserRecord {
  id: string;
  identifier: string; // Email or U-ID
  passwordHash: string;
  salt: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
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
  issuerSignatureData?: any;
  expiresAt?: string | null;
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
  documentConsents: DocumentConsentRecord[];
  governmentServices: GovernmentServiceRecord[];
  governmentApplications: GovernmentApplicationRecord[];
  applicationIntegrations: ApplicationIntegrationRecord[];
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
    // Production Safety Guard: Do not allow silent fallback to JSON store in production
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_JSON_DB_IN_PROD) {
      if (!process.env.DATABASE_URL && !process.env.UGOV_DATA_DIR) {
        throw new Error(
          "[CRITICAL SECURITY GUARD] Production requires DATABASE_URL or an explicitly configured persistent UGOV_DATA_DIR."
        );
      }
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

  private loadOrInitialize(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed: DatabaseSchema = JSON.parse(raw);
        if (!parsed.documentTypes || parsed.documentTypes.length === 0) {
          parsed.documentTypes = this.getDefaultDocumentTypes();
        }
        if (!parsed.citizenDocuments || parsed.citizenDocuments.length === 0) {
          const seeded = this.seedDefaultCitizenDocuments("usr-citizen-01");
          parsed.citizenDocuments = seeded.documents;
          parsed.documentConsents = seeded.consents;
        }
        if (!parsed.documentConsents) parsed.documentConsents = [];
        if (!parsed.governmentServices || parsed.governmentServices.length === 0) {
          parsed.governmentServices = this.getDefaultGovernmentServices();
        }
        if (!parsed.governmentApplications) parsed.governmentApplications = [];
        if (!parsed.applicationIntegrations) parsed.applicationIntegrations = [];
        return parsed;
      }
    } catch (err) {
      console.warn("Could not load database file, re-initializing store:", err);
    }
    return this.initializeSeed();
  }

  private save(): void {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write to database file:", err);
    }
  }

  private initializeSeed(): DatabaseSchema {
    const citizenPw = hashPassword("Citizen@UGov2026");
    const adminPw = hashPassword("Admin@UGov2026");
    const auditorPw = hashPassword("Auditor@UGov2026");

    const citizenUserId = "usr-citizen-01";
    const adminUserId = "usr-admin-01";
    const auditorUserId = "usr-auditor-01";

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
          displayName: "TEJAS GAVADE",
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
        {
          id: "aud-seed-01",
          timestamp: new Date().toISOString(),
          actorId: "SYSTEM",
          actorName: "U-GOV Core Gateway",
          actorRole: "System Node",
          action: "SYSTEM_INITIALIZATION",
          resource: "U-IDENTITY Store",
          result: "SUCCESS",
          context: "Seeded initial sovereign roles, permissions, and baseline cryptographic entities",
          prevHash: GENESIS_HASH,
          hash: computeAuditHash(
            GENESIS_HASH,
            `2026-08-01T00:00:00Z|SYSTEM|U-GOV Core Gateway|SYSTEM_INITIALIZATION|U-IDENTITY Store|SUCCESS|Seeded initial sovereign roles, permissions, and baseline cryptographic entities`
          ),
        },
      ],
      documentTypes: this.getDefaultDocumentTypes(),
      citizenDocuments: this.seedDefaultCitizenDocuments(citizenUserId).documents,
      documentConsents: this.seedDefaultCitizenDocuments(citizenUserId).consents,
      governmentServices: this.getDefaultGovernmentServices(),
      governmentApplications: [],
      applicationIntegrations: [],
    };

    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf-8");
    } catch (e) {
      console.warn("Could not save initial DB seed to disk:", e);
    }

    return initialDb;
  }

  // --- Users & Profiles ---

  public findUserByIdentifier(identifier: string): UserRecord | undefined {
    const clean = identifier.toLowerCase().trim();
    return this.data.users.find((u) => u.identifier.toLowerCase() === clean);
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
      this.data.auditEvents = this.data.auditEvents.slice(this.data.auditEvents.length - 50000);
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

  public getAuditEvents(limit: number = 50): AuditEventRecord[] {
    return [...this.data.auditEvents].reverse().slice(0, limit);
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
    this.save();
  }

  public updateDocument(id: string, updates: Partial<CitizenDocumentRecord>): void {
    const index = (this.data.citizenDocuments || []).findIndex((d) => d.id === id);
    if (index !== -1) {
      this.data.citizenDocuments[index] = {
        ...this.data.citizenDocuments[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.save();
    }
  }

  public deleteDocument(id: string): boolean {
    const initialLen = (this.data.citizenDocuments || []).length;
    this.data.citizenDocuments = (this.data.citizenDocuments || []).filter((d) => d.id !== id);
    this.data.documentConsents = (this.data.documentConsents || []).filter((c) => c.documentId !== id);
    const deleted = this.data.citizenDocuments.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  // --- U-DOCS Document Consents ---

  public createConsent(consent: DocumentConsentRecord): void {
    if (!this.data.documentConsents) {
      this.data.documentConsents = [];
    }
    this.data.documentConsents.push(consent);
    this.save();
  }

  public getConsentsByDocumentId(documentId: string): DocumentConsentRecord[] {
    return (this.data.documentConsents || []).filter((c) => c.documentId === documentId);
  }

  public getConsentsByOwner(ownerUserId: string): DocumentConsentRecord[] {
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
      consent.status = "REVOKED";
      consent.revokedAt = new Date().toISOString();
      this.save();
      return true;
    }
    return false;
  }

  public checkActiveConsent(documentId: string, recipientEntity: string): DocumentConsentRecord | undefined {
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
}

export const db = new Database();
