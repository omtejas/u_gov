import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  UserProfile,
  UserMode,
  LanguageCode,
  GovService,
  GovApplication,
  DigiDocument,
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

  // Document actions
  revokeConsent: (docId: string, consentId: string) => void;
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

  const revokeConsent = (docId: string, consentId: string) => {
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
