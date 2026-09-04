import { Readable } from "stream";

export interface FileMetadata {
  key: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  sha256Checksum: string;
}

export interface SaveFileOptions {
  mimeType: string;
  metadata?: Record<string, string>;
}

export interface StorageDriver {
  /**
   * Save a binary buffer or stream to the private vault
   * Returns the generated opaque storage key
   */
  save(content: Buffer, options: SaveFileOptions): Promise<{ key: string; sha256: string; size: number }>;

  /**
   * Read the binary content of a file identified by storage key
   */
  read(key: string): Promise<Buffer>;

  /**
   * Open a readable stream for high-performance downloading
   */
  readStream(key: string): Promise<Readable>;

  /**
   * Delete a file from the vault
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a file exists in the vault
   */
  exists(key: string): Promise<boolean>;

  /**
   * Compute live SHA-256 checksum of the stored file
   */
  computeChecksum(key: string): Promise<string>;

  /**
   * Retrieve file metadata (size, last modified)
   */
  getMetadata(key: string): Promise<FileMetadata>;
}
