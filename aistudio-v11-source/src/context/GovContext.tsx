import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  UserProfile,
  UserMode,
  LanguageCode,
  GovService,
  GovApplication,
  DigiDocument,
  DocumentType,
  AuditEvent,
  NotificationItem,
  GovernmentApplication,
  ApplicationReviewData,
  ServiceRequirementsEvaluation,
  ApplicationIntegrationTelemetry,
} from "../types";
import { MOCK_SERVICES } from "../data/mockServices";
import confetti from "canvas-confetti";

interface GovContextType {
  // Identity & Session
  user: UserProfile | null;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authStage: "idle" | "validating" | "establishing_session" | "loading_workspace";
  authError: string | null;
  clearAuthError: () => void;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  googleLogin: (credential: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    identifier: string;
    password: string;
    confirmPassword: string;
    displayName: string;
    phone?: string;
    state?: string;
    district?: string;
    termsAccepted: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<boolean>;

  // Mode & Preferences
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;

  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Domain Entities
  services: GovService[];
  applications: GovApplication[];
  documents: DigiDocument[];
  auditLogs: AuditEvent[];
  auditTotal: number;
  notifications: NotificationItem[];
  refreshServices: () => Promise<void>;
  refreshAuditLogs: (limit?: number, offset?: number) => Promise<void>;

  // Action Handlers
  selectedService: GovService | null;
  openServiceModal: (service: GovService) => void;
  closeServiceModal: () => void;

  // AI Assistant Modal
  isGBotOpen: boolean;
  openGBot: (prompt?: string) => void;
  closeGBot: () => void;
  gBotInitialPrompt: string;

  // Terminology Explainer
  selectedTerm: string | null;
  openExplain: (term: string) => void;
  closeExplain: () => void;

  // U-DOCS & U-CONSENT Engine
  documentTypes: DocumentType[];
  isLoadingDocuments: boolean;
  refreshDocuments: () => Promise<void>;
  depositDocument: (data: {
    title: string;
    documentTypeId: string;
    documentNumber: string;
    fileName: string;
    mimeType: string;
    fileData: string;
  }) => Promise<{ success: boolean; document?: DigiDocument; error?: string }>;
  downloadDocument: (docId: string, fileName?: string) => Promise<{ success: boolean; error?: string }>;
  verifyDocumentIntegrity: (docId: string) => Promise<{ valid: boolean; storedHash?: string; liveHash?: string; error?: string }>;
  deleteDocument: (docId: string) => Promise<{ success: boolean; error?: string }>;
  grantConsent: (docId: string, recipientEntity: string, purpose: string, durationDays: number) => Promise<{ success: boolean; error?: string }>;
  revokeConsent: (docId: string, consentId: string) => Promise<{ success: boolean; error?: string }>;
  uploadDocumentVersion: (
    docId: string,
    data: { fileName: string; mimeType: string; fileData: string; notes?: string }
  ) => Promise<{ success: boolean; version?: any; error?: string }>;

  // U-APPLICATIONS Engine (Phase 4.2 & 4.3)
  governmentApplications: GovernmentApplication[];
  isLoadingApplications: boolean;
  refreshApplications: () => Promise<void>;
  createGovernmentApplication: (
    serviceId: string,
    formData?: Record<string, any>,
    attachedDocumentIds?: string[]
  ) => Promise<{ success: boolean; application?: GovernmentApplication; error?: string }>;
  getGovernmentApplicationById: (
    applicationId: string
  ) => Promise<{ success: boolean; application?: GovernmentApplication; error?: string }>;
  attachDocumentToApplication: (
    applicationId: string,
    documentId: string
  ) => Promise<{ success: boolean; application?: GovernmentApplication; error?: string }>;
  removeDocumentFromApplication: (
    applicationId: string,
    documentId: string
  ) => Promise<{ success: boolean; application?: GovernmentApplication; error?: string }>;
  reviewGovernmentApplication: (
    applicationId: string
  ) => Promise<{ success: boolean; review?: ApplicationReviewData; error?: string }>;
  submitGovernmentApplication: (
    applicationId: string
  ) => Promise<{
    success: boolean;
    application?: GovernmentApplication;
    submission?: any;
    consentsGrantedCount?: number;
    error?: string;
  }>;
  cancelGovernmentApplication: (
    applicationId: string,
    reason?: string
  ) => Promise<{ success: boolean; application?: GovernmentApplication; error?: string }>;
  checkServiceRequirements: (
    serviceIdOrCode: string
  ) => Promise<{ success: boolean; evaluation?: ServiceRequirementsEvaluation; error?: string }>;
  getApplicationIntegrationTelemetry: (
    applicationId: string
  ) => Promise<{ success: boolean; telemetry?: ApplicationIntegrationTelemetry; error?: string }>;
  pollApplicationIntegrationStatus: (
    applicationId: string
  ) => Promise<{ success: boolean; status?: any; error?: string }>;
  activeApplicationModal: GovernmentApplication | null;
  openApplicationModal: (app: GovernmentApplication) => void;
  closeApplicationModal: () => void;
}

const GovContext = createContext<GovContextType | undefined>(undefined);

export const GovProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [authStage, setAuthStage] = useState<"idle" | "validating" | "establishing_session" | "loading_workspace">("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = () => setAuthError(null);

  const [mode, setMode] = useState<UserMode>("citizen");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [activeTab, setActiveTabState] = useState<string>("home");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [services, setServices] = useState<GovService[]>(MOCK_SERVICES);
  const [applications] = useState<GovApplication[]>([]);
  const [governmentApplications, setGovernmentApplications] = useState<GovernmentApplication[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState<boolean>(false);
  const [activeApplicationModal, setActiveApplicationModal] = useState<GovernmentApplication | null>(null);
  const [documents, setDocuments] = useState<DigiDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "n-1",
      title: "Action Required: Driving Licence",
      message: "Slot selection pending for practical test at Pune RTO track.",
      timestamp: "2 hours ago",
      type: "alert",
      priority: "high",
      read: false,
      relatedRef: "UGOV-2026-DL-448201",
    },
    {
      id: "n-2",
      title: "Certificate Deposited to DigiVault",
      message: "Your State Domicile Certificate has been digitally signed and issued.",
      timestamp: "1 day ago",
      type: "status",
      priority: "normal",
      read: true,
      relatedRef: "UGOV-2026-DOM-771920",
    },
  ]);

  // Modal states
  const [selectedService, setSelectedService] = useState<GovService | null>(null);
  const [isGBotOpen, setIsGBotOpen] = useState<boolean>(false);
  const [gBotInitialPrompt, setGBotInitialPrompt] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);

  // 1. Check active session & load public service catalogue on mount
  useEffect(() => {
    void checkCurrentSession();
    void refreshServices();
  }, []);

  const refreshServices = async () => {
    try {
      const res = await fetch("/api/v1/services", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.services)) {
        const normalized: GovService[] = data.services.map((s: any) => {
          const rawStatus = String(s.status || "AVAILABLE").toUpperCase();
          const mappedStatus: GovService["status"] =
            rawStatus === "AVAILABLE"
              ? "available"
              : rawStatus === "MAINTENANCE"
              ? "maintenance"
              : rawStatus === "COMING_SOON"
              ? "coming_soon"
              : "prototype";
          return {
            id: s.id,
            name: s.name,
            shortCode: s.serviceCode || s.shortCode || s.id,
            department: s.department,
            ministry: s.ministry || s.department,
            category: (String(s.category || "welfare").toLowerCase() as GovService["category"]),
            description: s.description || "",
            benefits: Array.isArray(s.benefits) ? s.benefits : [],
            eligibility: Array.isArray(s.eligibility) ? s.eligibility : [],
            requiredDocs: Array.isArray(s.requiredDocuments)
              ? s.requiredDocuments
              : Array.isArray(s.requiredDocs)
              ? s.requiredDocs
              : Array.isArray(s.requiredDocumentTypeIds)
              ? s.requiredDocumentTypeIds
              : [],
            slaDays: Number(s.slaDays ?? 15),
            fee: Number(s.fee ?? 0),
            officialPortal: s.officialPortal || "https://india.gov.in",
            status: mappedStatus,
            isPopular: Boolean(s.isPopular),
            featured: Boolean(s.featured),
          };
        });
        setServices(normalized);
      }
    } catch {
      // Keep initial catalogue fallback if offline
    }
  };

  const checkCurrentSession = async (): Promise<boolean> => {
    setIsLoadingAuth(true);
    try {
      const res = await fetch("/api/v1/auth/session", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.authenticated !== false && data.user) {
          const u = data.user;
          setUser({
            id: u.id,
            uId: u.identifier.includes("@") ? `U-${u.id.slice(-4)}-IND` : u.identifier,
            name: u.profile?.displayName || u.identifier,
            email: u.identifier,
            phone: u.profile?.phone || "",
            role: (u.roles?.[0]?.toLowerCase() as any) || "citizen",
            kycLevel: (u.profile?.kycLevel as any) || "Tier 1 (Basic)",
            aadhaarLinked: Boolean(u.profile?.aadhaarLinked),
            panLinked: Boolean(u.profile?.panLinked),
            state: u.profile?.state || "Maharashtra",
            district: u.profile?.district || "Pune",
          });
          setRoles(u.roles || ["CITIZEN"]);
          setPermissions(u.permissions || []);
          const prefLang = u.profile?.preferredLanguage;
          if (prefLang === "en" || prefLang === "hi" || prefLang === "mr" || prefLang === "kn") {
            setLanguage(prefLang);
          }
          setIsAuthenticated(true);
          void Promise.all([refreshAuditLogs(), refreshDocuments(), refreshApplications()]);
          return true;
        }
      }
      setIsAuthenticated(false);
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setDocuments([]);
      setAuditLogs([]);
      setAuditTotal(0);
      setGovernmentApplications([]);
      return false;
    } catch (err) {
      console.warn("Session check offline or unauthenticated:", err);
      setIsAuthenticated(false);
      setUser(null);
      setRoles([]);
      setPermissions([]);
      return false;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const refreshAuditLogs = async (limit = 50, offset = 0) => {
    try {
      const res = await fetch(`/api/v1/auth/audit/events?limit=${limit}&offset=${offset}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          setAuditTotal(typeof data.total === "number" ? data.total : data.events.length);
          setAuditLogs(
            data.events.map((e: any) => ({
              id: e.id,
              timestamp: e.timestamp,
              actor: {
                name: e.actorName,
                uId: e.actorId || "N/A",
                role: e.actorRole,
                ipAddress: e.ipAddress,
              },
              action: e.action,
              resource: e.resource,
              result: e.result,
              context: e.context,
            }))
          );
        }
      }
    } catch {
      // safe fallback
    }
  };

  // Protected route & role navigation guard
  const setActiveTab = (tab: string) => {
    const protectedTabs = [
      "dashboard",
      "documents",
      "tracker",
      "consent",
      "notifications",
      "mydata",
      "whereami",
      "profile",
      "audit",
      "officer",
      "admin",
    ];
    if (!isAuthenticated && protectedTabs.includes(tab)) {
      setAuthError(`Please sign in with your U-GOV account to access the ${tab.toUpperCase()} area.`);
      setActiveTabState("auth");
      return;
    }
    if (tab === "officer" && !roles.includes("OFFICIAL") && !roles.includes("OFFICER") && !roles.includes("ADMIN")) {
      setAuthError("Officer Desk access requires an account with OFFICIAL or ADMIN role.");
      return;
    }
    if (tab === "admin" && !roles.includes("ADMIN")) {
      setAuthError("U-SYS Admin console requires an account with ADMIN role.");
      return;
    }
    setAuthError(null);
    setActiveTabState(tab);
  };

  const postAuthJson = async (url: string, payload: unknown): Promise<{ res: Response; data: any }> => {
    const attempt = async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      return { res, data };
    };

    try {
      const first = await attempt();
      if ([502, 503, 504].includes(first.res.status)) {
        await new Promise((r) => setTimeout(r, 450));
        return await attempt();
      }
      return first;
    } catch {
      await new Promise((r) => setTimeout(r, 450));
      return await attempt();
    }
  };

  // Login handler
  const login = async (identifier: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    setAuthStage("validating");
    setIsLoadingAuth(true);
    try {
      const { res, data } = await postAuthJson("/api/v1/auth/login", { identifier, password });
      if (!res.ok || !data?.success) {
        const err =
          data?.message ||
          data?.error ||
          `Authentication service unavailable (HTTP ${res.status}). Please try again.`;
        setAuthError(err);
        return { success: false, error: err };
      }

      setAuthStage("establishing_session");
      const sessionActive = await checkCurrentSession();
      if (!sessionActive) {
        const err = "Sign-in succeeded, but your browser blocked the session cookie in this embedded preview. Enable third-party/partitioned cookies or open the app URL in a standalone browser tab.";
        setAuthError(err);
        return { success: false, error: err };
      }
      setAuthStage("loading_workspace");
      await Promise.all([refreshAuditLogs(), refreshDocuments(), refreshApplications()]);
      setActiveTabState("dashboard");
      return { success: true };
    } catch {
      const errMsg = "Unable to connect to authentication gateway. Please ensure the server is running and retry.";
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsLoadingAuth(false);
      setAuthStage("idle");
    }
  };

  // Google OpenID Connect handler: backend verifies the ID token and creates the same U-GOV session.
  const googleLogin = async (credential: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    setAuthStage("validating");
    setIsLoadingAuth(true);
    try {
      const { res, data } = await postAuthJson("/api/v1/auth/google", { credential });
      if (!res.ok || !data?.success) {
        const error =
          data?.error ||
          data?.message ||
          `Google sign-in failed (HTTP ${res.status}).`;
        setAuthError(error);
        return { success: false, error };
      }
      setAuthStage("establishing_session");
      const sessionActive = await checkCurrentSession();
      if (!sessionActive) {
        const error = "Google sign-in succeeded, but your browser blocked the session cookie in this embedded preview. Allow partitioned cookies or open in a standalone tab.";
        setAuthError(error);
        return { success: false, error };
      }
      setAuthStage("loading_workspace");
      await Promise.all([refreshAuditLogs(), refreshDocuments(), refreshApplications()]);
      setActiveTabState("dashboard");
      return { success: true };
    } catch {
      const error = "Unable to connect to the U-GOV authentication gateway. Please retry.";
      setAuthError(error);
      return { success: false, error };
    } finally {
      setIsLoadingAuth(false);
      setAuthStage("idle");
    }
  };

  // Register handler
  const register = async (formData: {
    identifier: string;
    password: string;
    confirmPassword: string;
    displayName: string;
    phone?: string;
    state?: string;
    district?: string;
    termsAccepted: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    setAuthStage("validating");
    setIsLoadingAuth(true);
    try {
      const { res, data } = await postAuthJson("/api/v1/auth/register", formData);
      if (!res.ok || !data?.success) {
        const err =
          data?.message ||
          data?.error ||
          `Registration failed (HTTP ${res.status}).`;
        setAuthError(err);
        return { success: false, error: err };
      }

      setAuthStage("establishing_session");
      const sessionActive = await checkCurrentSession();
      if (!sessionActive) {
        const err = "Account created, but your browser blocked the session cookie in this embedded preview. Open the app URL in a standalone tab to sign in.";
        setAuthError(err);
        return { success: false, error: err };
      }
      setAuthStage("loading_workspace");
      await refreshAuditLogs();
      setActiveTabState("dashboard");
      return { success: true };
    } catch {
      const errMsg = "Unable to register account. Please ensure the server is running and retry.";
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsLoadingAuth(false);
      setAuthStage("idle");
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setMode("citizen");
      setDocuments([]);
      setAuditLogs([]);
      setAuditTotal(0);
      setGovernmentApplications([]);
      setActiveTabState("home");
    }
  };

  // Profile update handler
  const updateProfile = async (data: Partial<UserProfile>): Promise<boolean> => {
    try {
      const payload: Record<string, unknown> = {};
      const resolvedDisplayName = (data as any).displayName ?? data.name;
      if (resolvedDisplayName !== undefined) payload.displayName = resolvedDisplayName;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.state !== undefined) payload.state = data.state;
      if (data.district !== undefined) payload.district = data.district;
      if ((data as any).preferredLanguage !== undefined) payload.preferredLanguage = (data as any).preferredLanguage;

      const res = await fetch("/api/v1/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await checkCurrentSession();
        await refreshAuditLogs();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const openServiceModal = (service: GovService) => {
    setSelectedService(service);
  };

  const closeServiceModal = () => {
    setSelectedService(null);
  };

  const openGBot = (prompt?: string) => {
    if (prompt) setGBotInitialPrompt(prompt);
    setIsGBotOpen(true);
  };

  const closeGBot = () => {
    setIsGBotOpen(false);
  };

  const openExplain = (term: string) => {
    setSelectedTerm(term);
  };

  const closeExplain = () => {
    setSelectedTerm(null);
  };

  // --- U-DOCS & U-CONSENT Engine Methods ---

  const refreshDocuments = async () => {
    setIsLoadingDocuments(true);
    try {
      // 1. Fetch types
      const typesRes = await fetch("/api/v1/documents/types", { credentials: "include" });
      let typesData: DocumentType[] = [];
      if (typesRes.ok) {
        const td = await typesRes.json();
        if (td.success && Array.isArray(td.types)) {
          typesData = td.types;
          setDocumentTypes(td.types);
        }
      }

      // 2. Fetch consents
      const consentsRes = await fetch("/api/v1/documents/consents/all", { credentials: "include" });
      let consentsData: any[] = [];
      if (consentsRes.ok) {
        const cd = await consentsRes.json();
        if (cd.success && Array.isArray(cd.consents)) {
          consentsData = cd.consents;
        }
      }

      // 3. Fetch citizen documents
      const docsRes = await fetch("/api/v1/documents", { credentials: "include" });
      if (docsRes.ok) {
        const dd = await docsRes.json();
        if (dd.success && Array.isArray(dd.documents)) {
          const mappedDocs: DigiDocument[] = dd.documents.map((bd: any) => {
            const docConsents = consentsData
              .filter((c: any) => c.documentId === bd.id)
              .map((c: any) => ({
                id: c.id,
                documentId: c.documentId,
                accessor: c.recipientEntity,
                recipientEntity: c.recipientEntity,
                purpose: c.purpose,
                grantedAt: c.grantedAt ? c.grantedAt.split("T")[0] : new Date().toISOString().split("T")[0],
                expiresAt: c.expiresAt ? c.expiresAt.split("T")[0] : "2026-12-31",
                revokedAt: c.revokedAt,
                status: (c.status.toLowerCase() as any) || "active",
              }));

            const typeObj = typesData.find((t) => t.id === bd.documentTypeId);

            return {
              id: bd.id,
              name: bd.title,
              docNumber: bd.documentNumber || "XXXX-XXXX",
              type: typeObj?.name || "Citizen Identity Credential",
              documentTypeId: bd.documentTypeId,
              issuer: typeObj?.issuingAuthority || "Competent Authority",
              issuedAt: bd.createdAt ? bd.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
              verified: bd.verificationStatus === "EXTERNALLY_VERIFIED",
              verificationStatus: bd.verificationStatus || "SELF_ATTESTED",
              fileSize: bd.fileSizeBytes ? `${(bd.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB` : "0.5 MB",
              fileSizeBytes: bd.fileSizeBytes,
              fileName: bd.fileName,
              mimeType: bd.mimeType,
              sha256Checksum: bd.sha256Checksum,
              storageKey: bd.storageKey,
              consents: docConsents,
              integrityStatus: "UNVERIFIED" as const,
              currentVersion: bd.currentVersion || 1,
            };
          });
          setDocuments(mappedDocs);
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote documents:", err);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const depositDocument = async (data: {
    title: string;
    documentTypeId: string;
    documentNumber: string;
    fileName: string;
    mimeType: string;
    fileData: string;
  }): Promise<{ success: boolean; document?: DigiDocument; error?: string }> => {
    try {
      const res = await fetch("/api/v1/documents/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        return { success: false, error: resData.error || "Failed to deposit document." };
      }
      await refreshDocuments();
      await refreshAuditLogs();
      return { success: true, document: resData.document };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error during deposit." };
    }
  };

  const downloadDocument = async (
    docId: string,
    customFileName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/documents/${docId}/download`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || `Download failed (${res.status})` };
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = customFileName || `document-${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      await refreshAuditLogs();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error during download." };
    }
  };

  const verifyDocumentIntegrity = async (
    docId: string
  ): Promise<{ valid: boolean; storedHash?: string; liveHash?: string; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/documents/${docId}/verify-integrity`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { valid: false, error: data.error || "Integrity verification request failed" };
      }
      const isValid = data.integrity === "VALID";
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                integrityStatus: isValid ? "VALID" : "FAILED",
                verificationStatus: isValid ? "INTEGRITY_VERIFIED" : "SELF_ATTESTED",
                sha256Checksum: data.checksum || d.sha256Checksum,
                lastVerifiedAt: data.verifiedAt,
              }
            : d
        )
      );
      await refreshAuditLogs();
      return { valid: isValid, storedHash: data.checksum, liveHash: data.liveChecksum };
    } catch (err: any) {
      return { valid: false, error: err.message || "Network error during integrity verification" };
    }
  };

  const deleteDocument = async (docId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/documents/${docId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || !resData.success) {
        return { success: false, error: resData.error || "Failed to delete document." };
      }
      await refreshDocuments();
      await refreshAuditLogs();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error during deletion." };
    }
  };

  const grantConsent = async (
    docId: string,
    recipientEntity: string,
    purpose: string,
    durationDays: number = 30
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/documents/${docId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientEntity, purpose, durationDays }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        return { success: false, error: resData.error || "Failed to grant consent." };
      }
      await refreshDocuments();
      await refreshAuditLogs();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error while granting consent." };
    }
  };

  const revokeConsent = async (
    docId: string,
    consentId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/documents/consent/${consentId}/revoke`, {
        method: "POST",
        credentials: "include",
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || !resData.success) {
        return { success: false, error: resData.error || "Failed to revoke consent." };
      }
      await refreshDocuments();
      await refreshAuditLogs();
      return { success: true };
    } catch (err: any) {
      // Local optimistic fallback
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id === docId) {
            return {
              ...d,
              consents: d.consents.map((c) =>
                c.id === consentId ? { ...c, status: "revoked" as const } : c
              ),
            };
          }
          return d;
        })
      );
      return { success: false, error: err.message || "Network error while revoking consent." };
    }
  };

  const uploadDocumentVersion = async (
    docId: string,
    data: { fileName: string; mimeType: string; fileData: string; notes?: string }
  ): Promise<{ success: boolean; version?: any; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/documents/${docId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        return { success: false, error: resData.error || "Failed to upload document version." };
      }
      await refreshDocuments();
      await refreshAuditLogs();
      return { success: true, version: resData.version };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error during version upload." };
    }
  };

  // U-APPLICATIONS Lifecycle Implementation
  const refreshApplications = async (): Promise<void> => {
    setIsLoadingApplications(true);
    try {
      const res = await fetch("/api/v1/applications", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) {
        setGovernmentApplications(data.applications || []);
      }
    } catch (e) {
      console.warn("Could not refresh applications:", e);
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const createGovernmentApplication = async (
    serviceId: string,
    formData?: Record<string, any>,
    attachedDocumentIds?: string[]
  ): Promise<{ success: boolean; application?: GovernmentApplication; error?: string }> => {
    try {
      const res = await fetch("/api/v1/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ serviceId, formData, attachedDocumentIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to create application." };
      }
      await refreshApplications();
      await refreshAuditLogs();
      return { success: true, application: data.application };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error while creating application." };
    }
  };

  const getGovernmentApplicationById = async (
    applicationId: string
  ): Promise<{ success: boolean; application?: GovernmentApplication; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/applications/${applicationId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to fetch application." };
      }
      return { success: true, application: data.application };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error fetching application." };
    }
  };

  const attachDocumentToApplication = async (
    applicationId: string,
    documentId: string
  ): Promise<{ success: boolean; application?: GovernmentApplication; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/applications/${applicationId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to attach document." };
      }
      await refreshApplications();
      await refreshAuditLogs();
      if (activeApplicationModal && activeApplicationModal.id === applicationId) {
        setActiveApplicationModal(data.application);
      }
      return { success: true, application: data.application };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error attaching document." };
    }
  };

  const removeDocumentFromApplication = async (
    applicationId: string,
    documentId: string
  ): Promise<{ success: boolean; application?: GovernmentApplication; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/applications/${applicationId}/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to remove document." };
      }
      await refreshApplications();
      await refreshAuditLogs();
      if (activeApplicationModal && activeApplicationModal.id === applicationId) {
        setActiveApplicationModal(data.application);
      }
      return { success: true, application: data.application };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error removing document." };
    }
  };

  const reviewGovernmentApplication = async (
    applicationId: string
  ): Promise<{ success: boolean; review?: ApplicationReviewData; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/applications/${applicationId}/review`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to retrieve review disclosures." };
      }
      return { success: true, review: data.review };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error reviewing application." };
    }
  };

  const submitGovernmentApplication = async (
    applicationId: string
  ): Promise<{
    success: boolean;
    application?: GovernmentApplication;
    submission?: any;
    consentsGrantedCount?: number;
    error?: string;
  }> => {
    try {
      const res = await fetch(`/api/v1/applications/${applicationId}/submit`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to submit application." };
      }
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FF9933", "#FFFFFF", "#138808", "#0B1F3A"],
        });
      } catch (e) {
        // confetti fallback
      }
      await refreshApplications();
      await refreshDocuments();
      await refreshAuditLogs();
      if (activeApplicationModal && activeApplicationModal.id === applicationId) {
        setActiveApplicationModal(data.application);
      }
      return {
        success: true,
        application: data.application,
        submission: data.submission,
        consentsGrantedCount: data.consentsGrantedCount,
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error submitting application." };
    }
  };

  const cancelGovernmentApplication = async (
    applicationId: string,
    reason?: string
  ): Promise<{ success: boolean; application?: GovernmentApplication; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/applications/${applicationId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to cancel application." };
      }
      await refreshApplications();
      await refreshAuditLogs();
      if (activeApplicationModal && activeApplicationModal.id === applicationId) {
        setActiveApplicationModal(data.application);
      }
      return { success: true, application: data.application };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error cancelling application." };
    }
  };

  const checkServiceRequirements = async (
    serviceIdOrCode: string
  ): Promise<{ success: boolean; evaluation?: ServiceRequirementsEvaluation; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/services/${serviceIdOrCode}/requirements`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to check service requirements." };
      }
      return { success: true, evaluation: data.evaluation };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error checking requirements." };
    }
  };

  const getApplicationIntegrationTelemetry = async (
    applicationId: string
  ): Promise<{ success: boolean; telemetry?: ApplicationIntegrationTelemetry; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/integrations/applications/${applicationId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to fetch integration telemetry." };
      }
      return { success: true, telemetry: data };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error fetching integration telemetry." };
    }
  };

  const pollApplicationIntegrationStatus = async (
    applicationId: string
  ): Promise<{ success: boolean; status?: any; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/integrations/applications/${applicationId}/status`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to poll integration status." };
      }
      await refreshApplications();
      await refreshAuditLogs();
      return { success: true, status: data.status };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error polling status." };
    }
  };

  const openApplicationModal = (app: GovernmentApplication) => {
    setActiveApplicationModal(app);
  };

  const closeApplicationModal = () => {
    setActiveApplicationModal(null);
  };

  return (
    <GovContext.Provider
      value={{
        user,
        roles,
        permissions,
        isAuthenticated,
        isLoadingAuth,
        authStage,
        authError,
        clearAuthError,
        login,
        googleLogin,
        register,
        logout,
        updateProfile,
        mode,
        setMode,
        language,
        setLanguage,
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        services,
        applications,
        governmentApplications,
        isLoadingApplications,
        refreshApplications,
        createGovernmentApplication,
        getGovernmentApplicationById,
        attachDocumentToApplication,
        removeDocumentFromApplication,
        reviewGovernmentApplication,
        submitGovernmentApplication,
        cancelGovernmentApplication,
        checkServiceRequirements,
        getApplicationIntegrationTelemetry,
        pollApplicationIntegrationStatus,
        activeApplicationModal,
        openApplicationModal,
        closeApplicationModal,
        documents,
        documentTypes,
        isLoadingDocuments,
        refreshDocuments,
        depositDocument,
        downloadDocument,
        verifyDocumentIntegrity,
        deleteDocument,
        grantConsent,
        auditLogs,
        auditTotal,
        refreshServices,
        refreshAuditLogs,
        notifications,
        selectedService,
        openServiceModal,
        closeServiceModal,
        isGBotOpen,
        openGBot,
        closeGBot,
        gBotInitialPrompt,
        selectedTerm,
        openExplain,
        closeExplain,
        revokeConsent,
        uploadDocumentVersion,
      }}
    >
      {children}
    </GovContext.Provider>
  );
};

export const useGov = (): GovContextType => {
  const context = useContext(GovContext);
  if (!context) {
    throw new Error("useGov must be used within a GovProvider");
  }
  return context;
};
