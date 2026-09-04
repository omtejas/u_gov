import crypto from "crypto";

/**
 * High-Assurance Password Hashing using Node.js Native scrypt
 * Zero external native dependencies for maximum security and Windows portability
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString("hex"),
    salt,
  };
}

/**
 * Constant-time password verification to protect against timing attacks
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString("hex"), "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    if (keyBuffer.length !== storedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(keyBuffer, storedBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Generate cryptographically secure random session tokens (256-bit entropy)
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash session token with SHA-256 before database storage
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Compute SHA-256 hash for tamper-evident chained audit ledger
 */
export function computeAuditHash(prevHash: string, canonicalData: string): string {
  return crypto.createHash("sha256").update(`${prevHash}|${canonicalData}`).digest("hex");
}

