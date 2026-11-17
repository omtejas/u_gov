import crypto from "crypto";
import { verifyGoogleIdToken } from "../auth/googleIdentity";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "jwk" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const jwk = { ...publicKey, kid: "test-google-key", alg: "RS256", use: "sig" };
(globalThis as any).fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), {
  status: 200,
  headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
});

function token(overrides: Record<string, unknown> = {}, tamper = false): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "RS256", kid: "test-google-key", typ: "JWT" });
  const claims = encode({
    iss: "https://accounts.google.com",
    aud: "test-client-id",
    sub: "google-subject-123",
    email: "citizen@example.com",
    email_verified: true,
    name: "Demo Citizen",
    iat: now,
    exp: now + 300,
    nonce: "expected-nonce",
    ...overrides,
  });
  const signingInput = `${header}.${claims}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
  return tamper ? `${header}.${claims}.${Buffer.from("invalid-signature").toString("base64url")}` : `${signingInput}.${signature}`;
}

async function run() {
  let passed = 0;
  let failed = 0;
  const check = (condition: boolean, label: string) => {
    if (condition) { passed++; console.log(`PASS: ${label}`); }
    else { failed++; console.error(`FAIL: ${label}`); }
  };
  const valid = await verifyGoogleIdToken(token(), "test-client-id", "expected-nonce");
  check(valid.sub === "google-subject-123" && valid.email === "citizen@example.com", "valid signed Google ID token is accepted");

  for (const [label, jwt, audience, nonce] of [
    ["wrong audience rejected", token(), "another-client-id", "expected-nonce"],
    ["nonce mismatch rejected", token(), "test-client-id", "wrong-nonce"],
    ["expired token rejected", token({ exp: Math.floor(Date.now() / 1000) - 10 }), "test-client-id", "expected-nonce"],
    ["unverified email rejected", token({ email_verified: false }), "test-client-id", "expected-nonce"],
    ["wrong issuer rejected", token({ iss: "https://attacker.example" }), "test-client-id", "expected-nonce"],
    ["invalid signature rejected", token({}, true), "test-client-id", "expected-nonce"],
  ] as Array<[string, string, string, string]>) {
    let rejected = false;
    try { await verifyGoogleIdToken(jwt, audience, nonce); } catch { rejected = true; }
    check(rejected, label);
  }
  console.log(`Google identity tests: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

run().catch((error) => { console.error(error); process.exit(1); });
