import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { StorageDriver, FileMetadata, SaveFileOptions } from "./StorageDriver";

export class LocalStorageDriver implements StorageDriver {
  private vaultDirectory: string;

  constructor(vaultDir?: string) {
    if (vaultDir) {
      this.vaultDirectory = path.resolve(vaultDir);
    } else {
      // Render and similar hosts provide a mounted persistent directory through
      // this variable. Local development continues to use ./storage/vault.
      const dataDirectory = process.env.UGOV_DATA_DIR
        ? path.resolve(process.env.UGOV_DATA_DIR)
        : path.resolve(process.cwd(), "storage");
      this.vaultDirectory = path.join(dataDirectory, "vault");
    }
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.vaultDirectory)) {
      fs.mkdirSync(this.vaultDirectory, { recursive: true, mode: 0o700 });
    }
  }

  private getFilePath(key: string): string {
    // Prevent directory traversal attacks
    const sanitizedKey = path.basename(key);
    if (!sanitizedKey || sanitizedKey !== key) {
      throw new Error("Invalid storage key detected: directory traversal prohibited");
    }
    return path.join(this.vaultDirectory, sanitizedKey);
  }

  public async save(
    content: Buffer,
    options: SaveFileOptions
  ): Promise<{ key: string; sha256: string; size: number }> {
    this.ensureDirectoryExists();

    // Generate random UUID key (never user-controlled filename)
    const key = crypto.randomUUID();
    const targetPath = this.getFilePath(key);

    // Compute SHA-256 checksum over exact raw binary
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");

    // Write file with restricted permissions (0o600: read/write by owner only)
    await fs.promises.writeFile(targetPath, content, { mode: 0o600 });

    // Store minimal sidecar metadata for quick inspection
    const metaPath = `${targetPath}.meta.json`;
    const metadata: FileMetadata = {
      key,
      sizeBytes: content.length,
      mimeType: options.mimeType,
      createdAt: new Date().toISOString(),
      sha256Checksum: sha256,
    };
    await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf-8");

    return {
      key,
      sha256,
      size: content.length,
    };
  }

  public async read(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Vault document not found: ${key}`);
    }
    return await fs.promises.readFile(filePath);
  }

  public async readStream(key: string): Promise<Readable> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Vault document not found: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  public async delete(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    const metaPath = `${filePath}.meta.json`;
    let deleted = false;

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      deleted = true;
    }
    if (fs.existsSync(metaPath)) {
      await fs.promises.unlink(metaPath);
    }
    return deleted;
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  public async computeChecksum(key: string): Promise<string> {
    const content = await this.read(key);
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  public async getMetadata(key: string): Promise<FileMetadata> {
    const filePath = this.getFilePath(key);
    const metaPath = `${filePath}.meta.json`;

    if (fs.existsSync(metaPath)) {
      const raw = await fs.promises.readFile(metaPath, "utf-8");
      return JSON.parse(raw);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Vault document not found: ${key}`);
    }

    const stat = await fs.promises.stat(filePath);
    const checksum = await this.computeChecksum(key);

    return {
      key,
      sizeBytes: stat.size,
      mimeType: "application/octet-stream",
      createdAt: stat.birthtime.toISOString(),
      sha256Checksum: checksum,
    };
  }
}
