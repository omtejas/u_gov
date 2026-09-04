import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hashPassword } from "../auth/crypto";

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
}

const getDbPath = () => {
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

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadOrInitialize();
  }

  private loadOrInitialize(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(raw);
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
          displayName: "Ganesh Ramesh Gite",
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
        },
      ],
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
    this.data.auditEvents.unshift(event);
    if (this.data.auditEvents.length > 500) {
      this.data.auditEvents = this.data.auditEvents.slice(0, 500);
    }
    this.save();
  }

  public getAuditEvents(limit: number = 50): AuditEventRecord[] {
    return this.data.auditEvents.slice(0, limit);
  }
}

export const db = new Database();
