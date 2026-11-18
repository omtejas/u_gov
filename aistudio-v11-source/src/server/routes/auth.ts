import { Router, Response } from "express";
import crypto from "crypto";
import { db, UserRecord, ProfileRecord } from "../database/db";
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from "../auth/crypto";
import { AuthenticatedRequest, requireAuth, rateLimiter, csrfProtection, parseCookies } from "../middleware/auth";
import { verifyGoogleIdToken } from "../auth/googleIdentity";

export const authRouter = Router();

const isHttpsRequest = (req?: AuthenticatedRequest): boolean => {
  if (req) {
    const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
    const origin = String(req.headers.origin || "").trim().toLowerCase();
    const referer = String(req.headers.referer || "").trim().toLowerCase();
    const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim().toLowerCase();
    return Boolean(
      req.secure ||
      proto === "https" ||
      origin.startsWith("https://") ||
      referer.startsWith("https://") ||
      forwardedHost.endsWith(".run.app")
    );
  }
  return process.env.NODE_ENV === "production";
};

const getCookieHeader = (token: string, maxAge: number, req?: AuthenticatedRequest): string => {
  const isHttps = isHttpsRequest(req);
  return isHttps
    ? `ugov_session=${token}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=${maxAge}`
    : `ugov_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
};

/**
 * POST /api/v1/auth/register
 * Real user registration with input validation, password hashing, and audit logging
 */
authRouter.post(
  "/register",
  csrfProtection,
  rateLimiter(60000, 5),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { identifier, password, confirmPassword, displayName, phone, state, district, termsAccepted } = req.body;

      // 1. Validation
      if (!identifier || typeof identifier !== "string" || !identifier.trim()) {
        return res.status(400).json({ success: false, error: "Identifier (Email or U-ID) is required" });
      }
      const cleanIdentifier = identifier.toLowerCase().trim();

      if (!termsAccepted) {
        return res.status(400).json({ success: false, error: "You must accept the terms of service and privacy charter" });
      }

      if (!password || typeof password !== "string" || password.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters long",
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ success: false, error: "Passwords do not match" });
      }

      // 2. Check for duplicate account
      const existingUser = db.findUserByIdentifier(cleanIdentifier);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: "An account with this identifier is already registered. Please sign in.",
        });
      }

      // 3. Hash password with secure scrypt + salt
      const { hash, salt } = hashPassword(password);
      const userId = `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const now = new Date().toISOString();

      const newUser: UserRecord = {
        id: userId,
        identifier: cleanIdentifier,
        passwordHash: hash,
        salt,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };

      const newProfile: ProfileRecord = {
        id: `prof-${Date.now()}`,
        userId,
        displayName: displayName?.trim() || cleanIdentifier.split("@")[0],
        phone: phone?.trim() || "",
        preferredLanguage: "en",
        kycLevel: "Tier 1 (Basic)",
        aadhaarLinked: false,
        panLinked: false,
        state: state?.trim() || "Maharashtra",
        district: district?.trim() || "Pune",
        createdAt: now,
        updatedAt: now,
      };

      db.createUser(newUser, newProfile, "CITIZEN");

      // 4. Create initial active session
      const token = generateSessionToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      db.createSession({
        id: `sess-${Date.now()}`,
        userId,
        tokenHash,
        createdAt: now,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 5. Emit registration & login audit events
      db.recordAuditEvent({
        id: `aud-${Date.now()}-reg`,
        timestamp: now,
        actorId: userId,
        actorName: newProfile.displayName,
        actorRole: "Citizen",
        action: "USER_REGISTRATION",
        resource: `Account ${cleanIdentifier}`,
        result: "SUCCESS",
        context: "Citizen self-registered sovereign U-GOV account with scrypt password hash",
        ipAddress: req.ip,
      });

      // 6. Set HttpOnly Cookie (Strict: token is NOT leaked in JSON response body)
      res.setHeader("Set-Cookie", getCookieHeader(token, 604800, req));

      return res.status(201).json({
        success: true,
        message: "Account registered successfully",
        user: {
          id: newUser.id,
          identifier: newUser.identifier,
          profile: newProfile,
          roles: ["CITIZEN"],
          permissions: db.getUserPermissions(newUser.id),
        },
      });
    } catch (err: any) {
      console.error("Registration error:", err);
      return res.status(500).json({ success: false, error: "Internal server error during registration" });
    }
  }
);


/**
 * GET /api/v1/auth/google/nonce
 * Issues a one-time nonce bound to an HttpOnly same-site cookie.
 */

/** Public browser configuration; the OAuth client ID is not a secret. */
authRouter.get("/google/config", (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ success: true, enabled: Boolean(process.env.GOOGLE_CLIENT_ID), clientId: process.env.GOOGLE_CLIENT_ID || null });
});

authRouter.get("/google/nonce", (req: AuthenticatedRequest, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ success: false, error: "Google sign-in is not configured yet." });
  }
  const nonce = generateSessionToken();
  const isHttps = isHttpsRequest(req);
  res.setHeader("Set-Cookie", `ugov_google_nonce=${nonce}; Path=/api/v1/auth/google; HttpOnly; ${isHttps ? "SameSite=None; Secure; Partitioned" : "SameSite=Lax"}; Max-Age=300`);
  return res.json({ success: true, nonce });
});

/**
 * POST /api/v1/auth/google
 * Verifies a Google ID token, resolves a linked identity, and issues a normal U-GOV session.
 */
authRouter.post("/google", rateLimiter(60000, 10), async (req: AuthenticatedRequest, res: Response) => {
  const isHttps = isHttpsRequest(req);
  const clearNonce = `ugov_google_nonce=; Path=/api/v1/auth/google; HttpOnly; ${isHttps ? "SameSite=None; Secure; Partitioned" : "SameSite=Lax"}; Max-Age=0`;
  try {
    const host = req.get("host");
    const origin = req.get("origin");
    const trustProxy = Boolean((req as any).app?.get?.("trust proxy"));
    const forwardedHost = trustProxy
      ? String(req.headers["x-forwarded-host"] || "").split(",")[0].trim()
      : "";
    const allowedHosts = new Set([host, forwardedHost].filter(Boolean).map((h) => String(h).toLowerCase()));
    if (!origin || allowedHosts.size === 0 || !allowedHosts.has(new URL(origin).host.toLowerCase())) {
      res.setHeader("Set-Cookie", clearNonce);
      return res.status(403).json({ success: false, error: "Google sign-in request origin was rejected." });
    }
    const nonceCookie = parseCookies(req).ugov_google_nonce;
    const credential = req.body?.credential;
    if (!nonceCookie || typeof credential !== "string" || credential.length > 10000) {
      res.setHeader("Set-Cookie", clearNonce);
      return res.status(400).json({ success: false, error: "Google sign-in session expired. Please try again." });
    }
    const identity = await verifyGoogleIdToken(credential, process.env.GOOGLE_CLIENT_ID || "", nonceCookie);
    res.setHeader("Set-Cookie", clearNonce);

    let user = db.findUserByGoogleSub(identity.sub);
    const now = new Date().toISOString();
    let isNewAccount = false;
    if (!user) {
      const emailAccount = db.findUserByIdentifier(identity.email);
      if (emailAccount) {
        db.recordAuditEvent({
          id: `aud-${Date.now()}-google-collision`,
          timestamp: now,
          actorId: emailAccount.id,
          actorName: identity.email,
          actorRole: "Anonymous",
          action: "GOOGLE_ACCOUNT_LINK_BLOCKED",
          resource: "Google Sign-In",
          result: "BLOCKED",
          context: "Google identity matched an existing email account; explicit authenticated account linking is required.",
          ipAddress: req.ip,
        });
        return res.status(409).json({
          success: false,
          error: "An account already exists with this email. Google sign-in cannot automatically link existing accounts in this version. Please use your U-GOV password."
        });
      }

      const randomPassword = generateSessionToken();
      const { hash, salt } = hashPassword(randomPassword);
      const userId = `usr-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      user = {
        id: userId,
        identifier: identity.email,
        passwordHash: hash,
        salt,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        googleSub: identity.sub,
      };
      const profile: ProfileRecord = {
        id: `prof-${Date.now()}`,
        userId,
        displayName: identity.name,
        phone: "",
        preferredLanguage: "en",
        kycLevel: "Tier 1 (Basic)",
        aadhaarLinked: false,
        panLinked: false,
        state: "",
        district: "",
        createdAt: now,
        updatedAt: now,
      };
      db.createUser(user, profile, "CITIZEN");
      isNewAccount = true;
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ success: false, error: "This U-GOV account is not active. Please contact support." });
    }

    user.googleSub = identity.sub;
    db.updateUser(user.id, { googleSub: identity.sub, lastLoginAt: now });
    const token = generateSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.createSession({
      id: `sess-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      userId: user.id,
      tokenHash,
      createdAt: now,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    const profile = db.getProfileByUserId(user.id);
    const roles = db.getUserRoles(user.id).map((role) => role.id);
    const permissions = db.getUserPermissions(user.id);
    db.recordAuditEvent({
      id: `aud-${Date.now()}-google-login`,
      timestamp: now,
      actorId: user.id,
      actorName: profile?.displayName || identity.email,
      actorRole: roles[0] || "CITIZEN",
      action: isNewAccount ? "GOOGLE_ACCOUNT_CREATED" : "GOOGLE_LOGIN",
      resource: "National Gateway Session",
      result: "SUCCESS",
      context: "Google OpenID Connect identity verified server-side; U-GOV session issued.",
      ipAddress: req.ip,
    });
    res.setHeader("Set-Cookie", [
      getCookieHeader(token, 604800, req),
      clearNonce,
    ]);
    return res.json({
      success: true,
      message: "Google authentication successful",
      user: {
        id: user.id,
        identifier: user.identifier,
        profile,
        roles,
        permissions,
      },
    });
  } catch (error: any) {
    res.setHeader("Set-Cookie", clearNonce);
    const message = error?.message || "Google authentication failed";
    const status = message.includes("not configured") ? 503 : 401;
    return res.status(status).json({ success: false, error: status === 503 ? message : "Google authentication could not be verified. Please try again." });
  }
});

/**
 * POST /api/v1/auth/login
 * Validates credentials, creates session, and records tamper-evident audit event
 */
authRouter.post(
  "/login",
  csrfProtection,
  rateLimiter(60000, 10),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
        return res.status(400).json({ success: false, error: "Identifier and password are required" });
      }

      const cleanIdentifier = identifier.toLowerCase().trim();
      const user = db.findUserByIdentifier(cleanIdentifier);

      // Generic error to prevent account enumeration
      if (!user || user.status !== "ACTIVE") {
        db.recordAuditEvent({
          id: `aud-${Date.now()}-fail`,
          timestamp: new Date().toISOString(),
          actorName: cleanIdentifier,
          actorRole: "Anonymous",
          action: "FAILED_LOGIN_ATTEMPT",
          resource: "National Gateway Login",
          result: "FAILED",
          context: "Invalid credentials supplied for identifier",
          ipAddress: req.ip,
        });

        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
          message: "The identifier or password you entered is incorrect.",
        });
      }

      const isMatch = verifyPassword(password, user.passwordHash, user.salt);
      if (!isMatch) {
        db.recordAuditEvent({
          id: `aud-${Date.now()}-fail`,
          timestamp: new Date().toISOString(),
          actorId: user.id,
          actorName: user.identifier,
          actorRole: "Citizen",
          action: "FAILED_LOGIN_ATTEMPT",
          resource: "National Gateway Login",
          result: "FAILED",
          context: "Password verification failed",
          ipAddress: req.ip,
        });

        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
          message: "The identifier or password you entered is incorrect.",
        });
      }

      // Success: Create session
      const token = generateSessionToken();
      const tokenHash = hashToken(token);
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      db.createSession({
        id: `sess-${Date.now()}`,
        userId: user.id,
        tokenHash,
        createdAt: now,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      db.updateUser(user.id, { lastLoginAt: now });
      const profile = db.getProfileByUserId(user.id);
      const roles = db.getUserRoles(user.id).map((r) => r.id);
      const permissions = db.getUserPermissions(user.id);

      // Record audit event
      db.recordAuditEvent({
        id: `aud-${Date.now()}-login`,
        timestamp: now,
        actorId: user.id,
        actorName: profile?.displayName || user.identifier,
        actorRole: roles[0] || "Citizen",
        action: "CITIZEN_LOGIN",
        resource: "National Gateway Session",
        result: "SUCCESS",
        context: `Authenticated successfully via password verification`,
        ipAddress: req.ip,
      });

      // Strict: token is set in HttpOnly cookie, NOT leaked in JSON response body
      res.setHeader("Set-Cookie", getCookieHeader(token, 604800, req));

      return res.json({
        success: true,
        message: "Authentication successful",
        user: {
          id: user.id,
          identifier: user.identifier,
          profile,
          roles,
          permissions,
        },
      });
    } catch (err: any) {
      console.error("Login error:", err);
      return res.status(500).json({ success: false, error: "Internal server error during login" });
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * Terminates session and invalidates cookie
 */
authRouter.post("/logout", csrfProtection, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.sessionRecord) {
      db.revokeSession(req.sessionRecord.id);
    }

    if (req.user) {
      db.recordAuditEvent({
        id: `aud-${Date.now()}-logout`,
        timestamp: new Date().toISOString(),
        actorId: req.user.id,
        actorName: req.profile?.displayName || req.user.identifier,
        actorRole: req.roles?.[0]?.name || "Citizen",
        action: "CITIZEN_LOGOUT",
        resource: "National Gateway Session",
        result: "INFO",
        context: "Session revoked and terminated securely",
        ipAddress: req.ip,
      });
    }

    res.setHeader("Set-Cookie", getCookieHeader("", 0, req));

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    console.error("Logout error:", err);
    return res.status(500).json({ success: false, error: "Internal server error during logout" });
  }
});

/**
 * POST /api/v1/auth/revoke-all
 * Invalidate all active sessions for the current authenticated user ("Sign out of all devices")
 */
authRouter.post("/revoke-all", requireAuth, csrfProtection, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    db.revokeAllUserSessions(userId);

    db.recordAuditEvent({
      id: `aud-${Date.now()}-revall`,
      timestamp: new Date().toISOString(),
      actorId: userId,
      actorName: req.profile?.displayName || req.user!.identifier,
      actorRole: req.roles?.[0]?.name || "Citizen",
      action: "ALL_SESSIONS_REVOKED",
      resource: "All Active Sessions",
      result: "SUCCESS",
      context: "Citizen terminated all active sessions across all devices",
      ipAddress: req.ip,
    });

    res.setHeader("Set-Cookie", getCookieHeader("", 0, req));
    return res.json({ success: true, message: "All active sessions have been terminated." });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to revoke all sessions" });
  }
});

/**
 * GET /api/v1/auth/sessions
 * Lists non-expired sessions for the authenticated user (never exposes tokenHash).
 */
authRouter.get("/sessions", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const sessions = db.getSessionsByUser(req.user!.id).map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt || null,
    ipAddress: s.ipAddress || "Unknown",
    userAgent: s.userAgent || "Browser Session",
    isCurrent: s.id === req.sessionRecord?.id,
  }));
  return res.json({ success: true, sessions });
});

/**
 * DELETE /api/v1/auth/sessions/:id
 * Revokes a single session owned by the authenticated user.
 */
authRouter.delete("/sessions/:id", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const session = db.findSessionById(req.params.id);
  if (!session || session.userId !== req.user!.id) {
    return res.status(404).json({ success: false, error: "Session not found." });
  }
  db.revokeSession(session.id);

  db.recordAuditEvent({
    id: `aud-${Date.now()}-revsess`,
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.profile?.displayName || req.user!.identifier,
    actorRole: req.roles?.[0]?.name || "Citizen",
    action: "SESSION_REVOKED",
    resource: `Session ${session.id}`,
    result: "SUCCESS",
    context: "Citizen revoked an individual session from Life Bio Security Settings",
    ipAddress: req.ip,
  });

  if (session.id === req.sessionRecord?.id) {
    res.setHeader("Set-Cookie", getCookieHeader("", 0, req));
  }
  return res.json({ success: true, message: "Session revoked." });
});

/**
 * POST /api/v1/auth/change-password
 * Updates scrypt password hash after verifying current password.
 */
authRouter.post("/change-password", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body || {};
    if (!currentPassword || typeof currentPassword !== "string") {
      return res.status(400).json({ success: false, error: "Current password is required." });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ success: false, error: "New password must be between 8 and 128 characters." });
    }
    if (confirmNewPassword !== undefined && newPassword !== confirmNewPassword) {
      return res.status(400).json({ success: false, error: "New passwords do not match." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, error: "New password must differ from current password." });
    }

    const user = db.findUserById(req.user!.id);
    if (!user || !verifyPassword(currentPassword, user.passwordHash, user.salt)) {
      return res.status(401).json({ success: false, error: "Current password is incorrect." });
    }

    const { hash, salt } = hashPassword(newPassword);
    db.updateUser(user.id, { passwordHash: hash, salt });

    db.recordAuditEvent({
      id: `aud-${Date.now()}-pwchg`,
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: req.profile?.displayName || user.identifier,
      actorRole: req.roles?.[0]?.name || "Citizen",
      action: "PASSWORD_CHANGED",
      resource: "Citizen Account Security",
      result: "SUCCESS",
      context: "Citizen rotated scrypt password hash securely",
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: "Password updated successfully." });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to change password." });
  }
});

/**
 * GET /api/v1/auth/session
 * Non-throwing session probe returning 200 { authenticated: boolean } so initial unauthenticated boot avoids 401 console errors.
 */
authRouter.get("/session", (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !req.sessionRecord) {
    return res.json({ success: true, authenticated: false, user: null });
  }
  return res.json({
    success: true,
    authenticated: true,
    user: {
      id: req.user.id,
      identifier: req.user.identifier,
      profile: req.profile,
      roles: req.roles?.map((r) => r.id) || ["CITIZEN"],
      permissions: req.permissions || [],
    },
  });
});

/**
 * GET /api/v1/auth/me
 * Retrieves authenticated user and profile context (401 when unauthenticated)
 */
authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    user: {
      id: req.user!.id,
      identifier: req.user!.identifier,
      profile: req.profile,
      roles: req.roles?.map((r) => r.id) || ["CITIZEN"],
      permissions: req.permissions || [],
    },
  });
});

/**
 * PATCH /api/v1/auth/profile
 * Updates citizen profile attributes
 */
authRouter.patch("/profile", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { displayName, phone, preferredLanguage, state, district } = req.body || {};

    const updates: Partial<ProfileRecord> = {};
    if (displayName !== undefined) {
      if (typeof displayName !== "string" || !displayName.trim() || displayName.trim().length > 80) {
        return res.status(400).json({ success: false, error: "Display name must be 1 to 80 characters." });
      }
      updates.displayName = displayName.trim();
    }
    if (phone !== undefined) {
      if (typeof phone !== "string" || phone.trim().length > 25) {
        return res.status(400).json({ success: false, error: "Phone number must be 25 characters or fewer." });
      }
      updates.phone = phone.trim();
    }
    if (preferredLanguage !== undefined) {
      const lang = String(preferredLanguage).trim();
      if (!["en", "hi", "mr", "kn"].includes(lang)) {
        return res.status(400).json({ success: false, error: "Unsupported preferred language code." });
      }
      updates.preferredLanguage = lang;
    }
    if (state !== undefined) {
      if (typeof state !== "string" || state.trim().length > 60) {
        return res.status(400).json({ success: false, error: "State must be 60 characters or fewer." });
      }
      updates.state = state.trim();
    }
    if (district !== undefined) {
      if (typeof district !== "string" || district.trim().length > 60) {
        return res.status(400).json({ success: false, error: "District must be 60 characters or fewer." });
      }
      updates.district = district.trim();
    }

    db.updateProfile(req.user!.id, updates);
    const updatedProfile = db.getProfileByUserId(req.user!.id);

    db.recordAuditEvent({
      id: `aud-${Date.now()}-prof`,
      timestamp: new Date().toISOString(),
      actorId: req.user!.id,
      actorName: updatedProfile?.displayName || req.user!.identifier,
      actorRole: req.roles?.[0]?.name || "Citizen",
      action: "PROFILE_UPDATE",
      resource: "Citizen Profile",
      result: "SUCCESS",
      context: `Citizen updated profile attributes: ${Object.keys(updates).join(", ")}`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, profile: updatedProfile });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

/**
 * GET /api/v1/auth/audit/events
 * Returns audit events scoped strictly by authorization with pagination support:
 * - Administrators & Auditors: Global ledger
 * - Citizens: Only their personal audit events (IDOR protection)
 */
authRouter.get("/audit/events", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const hasAuditRead =
    req.permissions?.includes("audit:read") ||
    req.roles?.some((r) => r.id === "ADMIN" || r.id === "AUDITOR");

  if (hasAuditRead) {
    const events = db.getAuditEvents(limit, offset);
    return res.json({ success: true, events, total: db.getAuditEventsCount(), scope: "global" });
  } else {
    // IDOR protection: Citizens can only query their own audit activity
    const allEvents = db.getAuditEvents(500, 0);
    const citizenAll = allEvents.filter((e) => e.actorId === req.user!.id);
    const events = citizenAll.slice(offset, offset + limit);
    return res.json({ success: true, events, total: citizenAll.length, scope: "personal" });
  }
});

/**
 * GET /api/v1/auth/audit/verify
 * Cryptographically verifies the SHA-256 hash-chain integrity of the audit ledger
 */
authRouter.get("/audit/verify", requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const verification = db.verifyAuditLedger();
  return res.json({
    success: true,
    verification: {
      ...verification,
      algorithm: "SHA-256 Hash-Chained Append-Only Ledger",
      verifiedAt: new Date().toISOString(),
    },
  });
});
