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
} from "../types";
import { MOCK_SERVICES } from "../data/mockServices";
import { MOCK_APPLICATIONS } from "../data/mockApplications";
import { MOCK_DOCUMENTS } from "../data/mockDocuments";
import confetti from "canvas-confetti";

interface GovContextType {
  // Identity & Session
  user: UserProfile | null;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authError: string | null;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
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
  notifications: NotificationItem[];
  refreshAuditLogs: () => Promise<void>;

  // Action Handlers
  selectedService: GovService | null;
  openServiceModal: (service: GovService) => void;
  closeServiceModal: () => void;
  applyForService: (serviceId: string) => { success: boolean; refNumber: string; message: string };

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
  uploadDocument: (doc: Partial<DigiDocument>) => void;
}

const GovContext = createContext<GovContextType | undefined>(undefined);

export const GovProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [mode, setMode] = useState<UserMode>("citizen");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [activeTab, setActiveTabState] = useState<string>("home");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [services, setServices] = useState<GovService[]>(MOCK_SERVICES);
  const [applications, setApplications] = useState<GovApplication[]>(MOCK_APPLICATIONS);
  const [documents, setDocuments] = useState<DigiDocument[]>(MOCK_DOCUMENTS);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);

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

  // 1. Check active session on mount
  useEffect(() => {
    checkCurrentSession();
    refreshAuditLogs();
    refreshDocuments();
  }, []);

  const checkCurrentSession = async () => {
    setIsLoadingAuth(true);
    try {
      const res = await fetch("/api/v1/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          const u = data.user;
          setUser({
            id: u.id,
            uId: u.identifier.includes("@") ? `U-${u.id.slice(-4)}-IND` : u.identifier,
            name: u.profile?.displayName || u.identifier,
            email: u.identifier,
            phone: u.profile?.phone || "+91 98234 56789",
            role: (u.roles?.[0]?.toLowerCase() as any) || "citizen",
            kycLevel: (u.profile?.kycLevel as any) || "Tier 1 (Basic)",
            aadhaarLinked: Boolean(u.profile?.aadhaarLinked),
            panLinked: Boolean(u.profile?.panLinked),
            state: u.profile?.state || "Maharashtra",
            district: u.profile?.district || "Pune",
          });
          setRoles(u.roles || ["CITIZEN"]);
          setPermissions(u.permissions || []);
          setIsAuthenticated(true);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (err) {
      console.warn("Session check offline or unauthenticated:", err);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const refreshAuditLogs = async () => {
    try {
      const res = await fetch("/api/v1/auth/audit/events");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
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
    } catch (e) {
      // safe fallback
    }
  };

  // Protected route navigation guard
  const setActiveTab = (tab: string) => {
    const protectedTabs = ["dashboard", "documents", "tracker", "audit", "admin"];
    if (!isAuthenticated && protectedTabs.includes(tab)) {
      setAuthError(`Please sign in with your U-GOV account to access the ${tab.toUpperCase()} area.`);
      setActiveTabState("auth");
      return;
    }
    setAuthError(null);
    setActiveTabState(tab);
  };

  // Login handler
  const login = async (identifier: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    setIsLoadingAuth(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const err = data.message || data.error || "Authentication failed";
        setAuthError(err);
        return { success: false, error: err };
      }

      await checkCurrentSession();
      await refreshAuditLogs();
      await refreshDocuments();
      setActiveTabState("dashboard");
      return { success: true };
    } catch (err: any) {
      const errMsg = "Unable to connect to authentication gateway. Please check network.";
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsLoadingAuth(false);
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
    setIsLoadingAuth(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const err = data.message || data.error || "Registration failed";
        setAuthError(err);
        return { success: false, error: err };
      }

      await checkCurrentSession();
      await refreshAuditLogs();
      setActiveTabState("dashboard");
      return { success: true };
    } catch (err: any) {
      const errMsg = "Unable to register account. Please check network.";
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsLoadingAuth(false);
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
      await refreshAuditLogs();
      setActiveTabState("home");
    }
  };

  // Profile update handler
  const updateProfile = async (data: Partial<UserProfile>): Promise<boolean> => {
    try {
      const res = await fetch("/api/v1/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await checkCurrentSession();
        await refreshAuditLogs();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const openServiceModal = (service: GovService) => {
    setSelectedService(service);
  };

  const closeServiceModal = () => {
    setSelectedService(null);
  };

  const applyForService = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      return { success: false, refNumber: "", message: "Service not found" };
    }

    const refNumber = `UGOV-2026-${service.shortCode}-${Math.floor(100000 + Math.random() * 900000)}`;

    const newApp: GovApplication = {
      id: `app-${Date.now()}`,
      refNumber,
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      department: service.department,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slaTargetDate: new Date(Date.now() + service.slaDays * 86400000).toISOString(),
      feePaid: service.fee,
      timeline: [
        {
          title: "Application Received & Form Verified",
          timestamp: "Just now",
          completed: true,
          notes: "Validated via citizen sovereign session credentials",
        },
        {
          title: "Departmental Scrutiny / Review",
          completed: false,
          current: true,
          notes: `Under SLA review (Target: ${service.slaDays} working days)`,
        },
        {
          title: "Final Decision & Issuance",
          completed: false,
        },
      ],
    };

    setApplications((prev) => [newApp, ...prev]);

    try {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (e) {}

    return {
      success: true,
      refNumber,
      message: `Your application for ${service.name} has been successfully filed with reference ${refNumber}.`,
    };
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

  const uploadDocument = (doc: Partial<DigiDocument>) => {
    const newDoc: DigiDocument = {
      id: `doc-${Date.now()}`,
      name: doc.name || "Custom Certificate",
      docNumber: doc.docNumber || `DOC-${Math.floor(10000 + Math.random() * 90000)}`,
      type: doc.type || "Citizen Credential",
      issuer: doc.issuer || "Authorized Public Department",
      issuedAt: new Date().toISOString().split("T")[0],
      verified: true,
      fileSize: "1.2 MB",
      consents: [],
    };
    setDocuments((prev) => [newDoc, ...prev]);
  };

  return (
    <GovContext.Provider
      value={{
        user,
        roles,
        permissions,
        isAuthenticated,
        isLoadingAuth,
        authError,
        login,
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
        refreshAuditLogs,
        notifications,
        selectedService,
        openServiceModal,
        closeServiceModal,
        applyForService,
        isGBotOpen,
        openGBot,
        closeGBot,
        gBotInitialPrompt,
        selectedTerm,
        openExplain,
        closeExplain,
        revokeConsent,
        uploadDocument,
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
