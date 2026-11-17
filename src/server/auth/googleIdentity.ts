import crypto from "crypto";

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

type GoogleJwk = { kid: string; kty: string; alg?: string; use?: string; [key: string]: unknown };
let cachedKeys: GoogleJwk[] = [];
let keysExpireAt = 0;

async function getGoogleSigningKeys(): Promise<GoogleJwk[]> {
  if (cachedKeys.length && Date.now() < keysExpireAt) return cachedKeys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Google signing keys are temporarily unavailable");
  const payload = await response.json() as { keys?: GoogleJwk[] };
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error("Google signing keys response was invalid");
  }
  cachedKeys = payload.keys;
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 3600);
  keysExpireAt = Date.now() + Math.max(60, Math.min(maxAge, 86400)) * 1000;
  return cachedKeys;
}

/** Verify a Google OpenID Connect ID token without trusting browser-supplied claims. */
export async function verifyGoogleIdToken(token: string, expectedAudience: string, expectedNonce?: string): Promise<GoogleIdentity> {
  if (!expectedAudience) throw new Error("Google sign-in is not configured");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Google credential");
  let header: any;
  let claims: any;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid Google credential");
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Unsupported Google token signature");
  }
  const keys = await getGoogleSigningKeys();
  const jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) {
    cachedKeys = [];
    throw new Error("Google signing key was not recognized; retry sign-in");
  }
  const publicKey = crypto.createPublicKey({ key: jwk as any, format: "jwk" });
  const validSignature = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], "base64url")
  );
  if (!validSignature) throw new Error("Google credential signature is invalid");

  const now = Math.floor(Date.now() / 1000);
  const issuerValid = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const audienceValid = claims.aud === expectedAudience ||
    (Array.isArray(claims.aud) && claims.aud.includes(expectedAudience));
  if (!issuerValid || !audienceValid || !claims.sub || typeof claims.sub !== "string") {
    throw new Error("Google credential issuer or audience is invalid");
  }
  if (!Number.isFinite(claims.exp) || claims.exp <= now ||
      (Number.isFinite(claims.iat) && claims.iat > now + 60)) {
    throw new Error("Google credential has expired or is not yet valid");
  }
  if (expectedNonce && claims.nonce !== expectedNonce) {
    throw new Error("Google sign-in nonce did not match");
  }
  if (claims.email_verified !== true || typeof claims.email !== "string" || !claims.email.trim()) {
    throw new Error("Google account must have a verified email address");
  }
  return {
    sub: claims.sub,
    email: claims.email.toLowerCase().trim(),
    emailVerified: true,
    name: typeof claims.name === "string" && claims.name.trim()
      ? claims.name.trim()
      : claims.email.split("@")[0],
  };
}
