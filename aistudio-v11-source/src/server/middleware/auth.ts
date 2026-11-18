import { Request, Response, NextFunction } from "express";
import { db, UserRecord, ProfileRecord, RoleRecord, SessionRecord } from "../database/db";
import { hashToken } from "../auth/crypto";

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  profile?: ProfileRecord;
  roles?: RoleRecord[];
  permissions?: string[];
  sessionRecord?: SessionRecord;
}

/**
 * Parses cookies from raw Cookie header without external dependencies
 */
export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const cookies: Record<string, string> = {};
  const parts = header.split(";");
  for (const part of parts) {
    const [key, ...val] = part.trim().split("=");
    if (key) {
      cookies[key] = decodeURIComponent(val.join("="));
    }
  }
  return cookies;
}

/**
 * Authentication Middleware: Validates session token from cookie or Authorization header
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    // 1. Check HttpOnly Cookie
    const cookies = parseCookies(req);
    if (cookies.ugov_session) {
      token = cookies.ugov_session;
    }

    // 2. Check Authorization Bearer Header (fallback for API clients)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      return next();
    }

    const tokenHash = hashToken(token);
    const session = db.findSessionByHash(tokenHash);

    if (!session) {
      return next();
    }

    const user = db.findUserById(session.userId);
    if (!user || user.status !== "ACTIVE") {
      return next();
    }

    const profile = db.getProfileByUserId(user.id);
    const roles = db.getUserRoles(user.id);
    const permissions = db.getUserPermissions(user.id);

    req.user = user;
    req.profile = profile;
    req.roles = roles;
    req.permissions = permissions;
    req.sessionRecord = session;

    next();
  } catch (err) {
    console.error("Authentication middleware error:", err);
    next();
  }
}

/**
 * Route Guard: Requires valid authentication
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.sessionRecord) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
      message: "Please sign in with your U-GOV citizen account to access this resource.",
    });
  }
  next();
}

/**
 * Route Guard: Requires specific role (RBAC)
 */
export function requireRole(...permittedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.roles) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const userRoleIds = req.roles.map((r) => r.id);
    const hasRole = permittedRoles.some((role) => userRoleIds.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        message: `This action requires one of the following roles: ${permittedRoles.join(", ")}.`,
      });
    }

    next();
  };
}

/**
 * Route Guard: Requires specific permission (PBAC)
 */
export function requirePermission(...neededPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.permissions) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const hasPermission = neededPermissions.every((perm) => req.permissions?.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Your account lacks the necessary permissions for this operation.",
      });
    }

    next();
  };
}

/**
 * Sliding window IP rate limiter for brute-force protection with expiry pruning
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function pruneRateLimitStore(now: number): void {
  if (rateLimitStore.size <= 500) return;
  for (const [entryKey, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(entryKey);
    }
  }
}

export function rateLimiter(windowMs: number = 60000, maxRequests: number = 10) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    pruneRateLimitStore(now);

    const record = rateLimitStore.get(key);

    if (!record || record.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
      return res.status(429).json({
        success: false,
        error: "Too many requests",
        message: `Too many authentication attempts. Please try again in ${waitSeconds} seconds.`,
      });
    }

    record.count++;
    next();
  };
}

/**
 * CSRF Protection Middleware for state-changing operations.
 * Validates Sec-Fetch-Site, Origin, and Referer headers against the trusted host.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const secFetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase().trim();
    if (secFetchSite && !["same-origin", "none"].includes(secFetchSite)) {
      return res.status(403).json({
        success: false,
        error: "CSRF check failed",
        message: "Cross-site mutation blocked by sovereign security policy.",
      });
    }

    const rawOrigin = req.headers.origin as string | undefined;
    const rawReferer = req.headers.referer as string | undefined;
    const headerToCheck = rawOrigin || rawReferer;
    const host = req.headers.host;

    if (rawOrigin === "null") {
      return res.status(403).json({
        success: false,
        error: "CSRF check failed",
        message: "Null Origin is not permitted for state-changing requests.",
      });
    }

    const cookies = parseCookies(req);
    const hasSessionCookie = Boolean(cookies.ugov_session);
    const looksLikeBrowser =
      Boolean(req.headers["sec-fetch-site"]) ||
      /Mozilla\//i.test(String(req.headers["user-agent"] || ""));

    if (hasSessionCookie && looksLikeBrowser && !headerToCheck) {
      return res.status(403).json({
        success: false,
        error: "CSRF check failed",
        message: "Browser-initiated cookie mutations require a matching same-origin header.",
      });
    }

    if (headerToCheck && host) {
      try {
        const originUrl = new URL(headerToCheck);
        const trustProxy = Boolean((req as any).app?.get?.("trust proxy"));
        const forwardedHost = trustProxy
          ? String(req.headers["x-forwarded-host"] || "").split(",")[0].trim()
          : "";
        const allowedHosts = new Set(
          [host, forwardedHost].filter(Boolean).map((h) => h.toLowerCase())
        );
        if (!allowedHosts.has(originUrl.host.toLowerCase())) {
          return res.status(403).json({
            success: false,
            error: "CSRF check failed",
            message: "Cross-origin request blocked by sovereign security policy.",
          });
        }
      } catch {
        return res.status(403).json({
          success: false,
          error: "Invalid Origin header",
        });
      }
    }
  }
  next();
}

