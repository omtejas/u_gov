import crypto from "node:crypto";
import { Readable } from "node:stream";
import type { FileMetadata, SaveFileOptions, StorageDriver } from "./StorageDriver";

/**
 * Private S3-compatible object storage driver.
 *
 * Configure with UGOV_STORAGE_TYPE=s3, UGOV_S3_ENDPOINT, UGOV_S3_BUCKET,
 * UGOV_S3_REGION, UGOV_S3_ACCESS_KEY_ID and UGOV_S3_SECRET_ACCESS_KEY.
 * The bucket must remain private; this driver never creates public ACLs.
 */
export class S3CompatibleStorageDriver implements StorageDriver {
  private readonly endpoint: URL;
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly sessionToken?: string;

  constructor() {
    const endpoint = process.env.UGOV_S3_ENDPOINT;
    const bucket = process.env.UGOV_S3_BUCKET;
    const region = process.env.UGOV_S3_REGION;
    const accessKey = process.env.UGOV_S3_ACCESS_KEY_ID;
    const secretKey = process.env.UGOV_S3_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !region || !accessKey || !secretKey) {
      throw new Error("S3 storage requires endpoint, bucket, region, access key and secret key configuration.");
    }
    this.endpoint = new URL(endpoint);
    if (this.endpoint.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new Error("S3 storage endpoint must use HTTPS in production.");
    }
    this.bucket = bucket;
    this.region = region;
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.sessionToken = process.env.UGOV_S3_SESSION_TOKEN || undefined;
  }

  private hmac(key: Buffer | string, value: string): Buffer {
    return crypto.createHmac("sha256", key).update(value, "utf8").digest();
  }

  private objectUrl(key: string): URL {
    if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid storage key.");
    const url = new URL(this.endpoint.toString());
    const prefix = url.pathname.replace(/\/$/, "");
    url.pathname = `${prefix}/${encodeURIComponent(this.bucket)}/${encodeURIComponent(key)}`;
    url.search = "";
    return url;
  }

  private async request(method: string, key: string, body?: Buffer, mimeType?: string): Promise<Response> {
    const url = this.objectUrl(key);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = crypto.createHash("sha256").update(body || Buffer.alloc(0)).digest("hex");
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (mimeType) headers["content-type"] = mimeType;
    if (this.sessionToken) headers["x-amz-security-token"] = this.sessionToken;

    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map(name => `${name}:${headers[name].trim()}\n`).join("");
    const canonicalRequest = [
      method,
      url.pathname,
      "",
      canonicalHeaders,
      signedHeaderNames.join(";"),
      payloadHash,
    ].join("\n");
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");
    const kDate = this.hmac(`AWS4${this.secretKey}`, dateStamp);
    const kRegion = this.hmac(kDate, this.region);
    const kService = this.hmac(kRegion, "s3");
    const kSigning = this.hmac(kService, "aws4_request");
    const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`;

    return fetch(url, {
      method,
      headers: { ...headers, Authorization: authorization },
      body: method === "PUT" ? body : undefined,
    });
  }

  async save(content: Buffer, options: SaveFileOptions): Promise<{ key: string; sha256: string; size: number }> {
    if (!Buffer.isBuffer(content) || content.length === 0) throw new Error("Cannot store an empty document.");
    const key = crypto.randomUUID();
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    const response = await this.request("PUT", key, content, options.mimeType);
    if (!response.ok) throw new Error(`Object storage upload failed (HTTP ${response.status}).`);
    return { key, sha256, size: content.length };
  }

  async read(key: string): Promise<Buffer> {
    const response = await this.request("GET", key);
    if (!response.ok) throw new Error(`Object storage read failed (HTTP ${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }

  async readStream(key: string): Promise<Readable> {
    return Readable.from(await this.read(key));
  }

  async delete(key: string): Promise<boolean> {
    const response = await this.request("DELETE", key);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Object storage delete failed (HTTP ${response.status}).`);
    return true;
  }

  async exists(key: string): Promise<boolean> {
    const response = await this.request("HEAD", key);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Object storage existence check failed (HTTP ${response.status}).`);
    return true;
  }

  async computeChecksum(key: string): Promise<string> {
    return crypto.createHash("sha256").update(await this.read(key)).digest("hex");
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const response = await this.request("HEAD", key);
    if (!response.ok) throw new Error(`Object storage metadata request failed (HTTP ${response.status}).`);
    const sizeBytes = Number(response.headers.get("content-length") || 0);
    const mimeType = response.headers.get("content-type") || "application/octet-stream";
    const createdAt = response.headers.get("last-modified") || new Date().toISOString();
    return {
      key,
      sizeBytes,
      mimeType,
      createdAt: new Date(createdAt).toISOString(),
      sha256Checksum: await this.computeChecksum(key),
    };
  }
}
