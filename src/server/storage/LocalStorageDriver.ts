import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { StorageDriver, FileMetadata, SaveFileOptions, StorageHealthResult } from "./StorageDriver";

export class LocalStorageDriver implements StorageDriver {
  private vaultDirectory: string;

  constructor(vaultDir?: string) {
    if (vaultDir) {
      this.vaultDirectory = path.resolve(vaultDir);
    } else {
      // Local filesystem storage is durable only when this directory is backed
      // by a persistent volume. Render's default filesystem is ephemeral.
      const dataDirectory = process.env.UGOV_DATA_DIR
        ? path.resolve(process.env.UGOV_DATA_DIR)
        : path.resolve(process.cwd(), "storage");
      this.vaultDirectory = path.join(dataDirectory, "vault");
    }
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    fs.mkdirSync(this.vaultDirectory, { recursive: true, mode: 0o700 });
    try {
      fs.chmodSync(this.vaultDirectory, 0o700);
    } catch {
      // Some filesystems do not support POSIX permission changes.
    }
  }

  private getFilePath(key: string): string {
    // Storage keys are opaque UUIDs; never accept user-controlled paths.
    const sanitizedKey = path.basename(key);
    if (!sanitizedKey || sanitizedKey !== key || !/^[0-9a-f-]{36}$/i.test(key)) {
      throw new Error("Invalid storage key: expected an opaque UUID.");
    }
    return path.join(this.vaultDirectory, sanitizedKey);
  }

  private async writeAtomically(targetPath: string, content: Buffer | string): Promise<void> {
    const temporaryPath = `${targetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    let handle: fs.promises.FileHandle | undefined;
    try {
      handle = await fs.promises.open(temporaryPath, "wx", 0o600);
      await handle.writeFile(content);
      await handle.sync();
      await handle.close();
      handle = undefined;
      await fs.promises.rename(temporaryPath, targetPath);
      try {
        await fs.promises.chmod(targetPath, 0o600);
      } catch {
        // Permission bits are best-effort on non-POSIX filesystems.
      }
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      await fs.promises.unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  public async checkHealth(): Promise<StorageHealthResult> {
    this.ensureDirectoryExists();
    const probe = path.join(this.vaultDirectory, `.health-${crypto.randomUUID()}`);
    try {
      await fs.promises.writeFile(probe, "ugov-storage-health", { flag: "wx", mode: 0o600 });
      await fs.promises.unlink(probe);
      return { healthy: true, provider: "local", detail: "Private local vault is writable." };
    } catch {
      await fs.promises.unlink(probe).catch(() => undefined);
      return { healthy: false, provider: "local", detail: "Private local vault is not writable." };
    }
  }

  public async save(
    content: Buffer,
    options: SaveFileOptions
  ): Promise<{ key: string; sha256: string; size: number }> {
    this.ensureDirectoryExists();
    if (!Buffer.isBuffer(content) || content.length === 0) {
      throw new Error("Cannot store an empty or invalid document payload.");
    }

    const key = crypto.randomUUID();
    const targetPath = this.getFilePath(key);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    const metadata: FileMetadata = {
      key,
      sizeBytes: content.length,
      mimeType: options.mimeType,
      createdAt: new Date().toISOString(),
      sha256Checksum: sha256,
    };

    // Publish the metadata only after the binary has been safely written.
    await this.writeAtomically(targetPath, content);
    try {
      await this.writeAtomically(`${targetPath}.meta.json`, JSON.stringify(metadata, null, 2));
    } catch (error) {
      await fs.promises.unlink(targetPath).catch(() => undefined);
      throw error;
    }

    return { key, sha256, size: content.length };
  }

  public async read(key: string): Promise<Buffer> {
    return fs.promises.readFile(this.getFilePath(key));
  }

  public async readStream(key: string): Promise<Readable> {
    const filePath = this.getFilePath(key);
    await fs.promises.access(filePath, fs.constants.R_OK);
    return fs.createReadStream(filePath);
  }

  public async delete(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    const metaPath = `${filePath}.meta.json`;
    let deleted = false;

    try {
      await fs.promises.unlink(filePath);
      deleted = true;
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }

    try {
      await fs.promises.unlink(metaPath);
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
    return deleted;
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await fs.promises.access(this.getFilePath(key), fs.constants.R_OK);
      return true;
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

    try {
      const raw = await fs.promises.readFile(metaPath, "utf-8");
      const metadata = JSON.parse(raw) as FileMetadata;
      if (metadata.key !== key || !Number.isFinite(metadata.sizeBytes) || !metadata.sha256Checksum) {
        throw new Error("Stored document metadata is invalid.");
      }
      return metadata;
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }

    const stat = await fs.promises.stat(filePath);
    return {
      key,
      sizeBytes: stat.size,
      mimeType: "application/octet-stream",
      createdAt: stat.birthtime.toISOString(),
      sha256Checksum: await this.computeChecksum(key),
    };
  }
}
