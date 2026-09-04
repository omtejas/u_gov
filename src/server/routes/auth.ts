import { Router, Response } from "express";
import { db, UserRecord, ProfileRecord, AuditEventRecord } from "../database/db";
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from "../auth/crypto";
import { AuthenticatedRequest, requireAuth, rateLimiter } from "../middleware/auth";

export const authRouter = Router();

/**
 * POST /api/v1/auth/register
 * Real user registration with input validation, password hashing, and audit logging
 */
authRouter.post("/register", rateLimiter(60000, 5), async (req: AuthenticatedRequest, res: Response) => {
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

    // 6. Set HttpOnly Cookie
    res.setHeader(
      "Set-Cookie",
      `ugov_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return res.status(201).json({
      success: true,
      message: "Account registered successfully",
      token,
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
});

/**
 * POST /api/v1/auth/login
 * Validates credentials, creates session, and records tamper-evident audit event
 */
authRouter.post("/login", rateLimiter(60000, 10), async (req: AuthenticatedRequest, res: Response) => {
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

    res.setHeader(
      "Set-Cookie",
      `ugov_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return res.json({
      success: true,
      message: "Authentication successful",
      token,
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
});

/**
 * POST /api/v1/auth/logout
 * Terminates session and invalidates cookie
 */
authRouter.post("/logout", async (req: AuthenticatedRequest, res: Response) => {
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

    res.setHeader(
      "Set-Cookie",
      `ugov_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    );

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    console.error("Logout error:", err);
    return res.status(500).json({ success: false, error: "Internal server error during logout" });
  }
});

/**
 * GET /api/v1/auth/me
 * Retrieves authenticated user and profile context
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
authRouter.patch("/profile", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { displayName, phone, preferredLanguage, state, district } = req.body;

    const updates: Partial<ProfileRecord> = {};
    if (displayName) updates.displayName = String(displayName).trim();
    if (phone) updates.phone = String(phone).trim();
    if (preferredLanguage) updates.preferredLanguage = String(preferredLanguage).trim();
    if (state) updates.state = String(state).trim();
    if (district) updates.district = String(district).trim();

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
 * GET /api/v1/audit/events
 * Returns live audit events from database
 */
authRouter.get("/audit/events", (req: AuthenticatedRequest, res: Response) => {
  const events = db.getAuditEvents(100);
  return res.json({ success: true, events });
});
