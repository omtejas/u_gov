import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface StorageReadiness {
  dataDirectory: string;
  ephemeralPath: boolean;
  directoryExists: boolean;
  writable: boolean;
  persistentMountVerified: boolean;
  mountPoint: string | null;
  filesystem: string | null;
  reason: string | null;
}

const EPHEMERAL_FILESYSTEMS = new Set(["overlay", "tmpfs", "ramfs", "proc", "sysfs", "devtmpfs"]);

export function isEphemeralDataPath(directory: string): boolean {
  const resolved = path.resolve(directory);
  return resolved === "/tmp" || resolved.startsWith("/tmp/") ||
    resolved === "/var/tmp" || resolved.startsWith("/var/tmp/");
}

function decodeMountField(value: string): string {
  return value.replace(/\\040/g, " ").replace(/\\011/g, "\t").replace(/\\012/g, "\n").replace(/\\134/g, "\\");
}

function findMount(directory: string): { mountPoint: string; filesystem: string } | null {
  if (process.platform !== "linux") return null;
  try {
    const target = path.resolve(directory);
    const entries = fs.readFileSync("/proc/self/mountinfo", "utf8").split("\n");
    const matches: Array<{ mountPoint: string; filesystem: string }> = [];
    for (const entry of entries) {
      if (!entry) continue;
      const separator = entry.indexOf(" - ");
      if (separator < 0) continue;
      const left = entry.slice(0, separator).split(" ");
      const right = entry.slice(separator + 3).split(" ");
      const mountPoint = decodeMountField(left[4] || "");
      const filesystem = right[0] || "";
      if (!mountPoint || mountPoint === "/") continue;
      if (target === mountPoint || target.startsWith(mountPoint.endsWith("/") ? mountPoint : mountPoint + "/")) {
        matches.push({ mountPoint, filesystem });
      }
    }
    matches.sort((a, b) => b.mountPoint.length - a.mountPoint.length);
    return matches[0] || null;
  } catch {
    return null;
  }
}

function probeWritable(directory: string): boolean {
  const probePath = path.join(directory, ".ugov-storage-check-" + crypto.randomUUID());
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(probePath, "wx", 0o600);
    fs.writeSync(descriptor, "storage-check");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.unlinkSync(probePath);
    return true;
  } catch {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* best effort */ }
    }
    try { fs.unlinkSync(probePath); } catch { /* best effort */ }
    return false;
  }
}

export function inspectStorageDirectory(directory: string): StorageReadiness {
  const dataDirectory = path.resolve(directory);
  const ephemeralPath = isEphemeralDataPath(dataDirectory);
  const directoryExists = fs.existsSync(dataDirectory) && fs.statSync(dataDirectory).isDirectory();
  const mount = findMount(dataDirectory);
  const mountIsPersistent = Boolean(mount && !EPHEMERAL_FILESYSTEMS.has(mount.filesystem));
  const writable = directoryExists ? probeWritable(dataDirectory) : false;
  const persistentMountVerified = !ephemeralPath && directoryExists && writable && mountIsPersistent;

  let reason: string | null = null;
  if (ephemeralPath) reason = "The configured data path is temporary.";
  else if (!directoryExists) reason = "The configured data directory does not exist.";
  else if (!mount) reason = "No dedicated non-root filesystem mount could be verified for this data path.";
  else if (!mountIsPersistent) reason = `The mounted filesystem type '${mount.filesystem}' is not accepted as persistent storage.`;
  else if (!writable) reason = "The mounted data directory is not writable.";

  return {
    dataDirectory,
    ephemeralPath,
    directoryExists,
    writable,
    persistentMountVerified,
    mountPoint: mount?.mountPoint || null,
    filesystem: mount?.filesystem || null,
    reason,
  };
}

export function assertProductionStorageReady(directory: string): void {
  const dataDirectory = path.resolve(directory);
  if (isEphemeralDataPath(dataDirectory)) {
    throw new Error("[CRITICAL STORAGE GUARD] Production storage cannot use /tmp or /var/tmp.");
  }

  // Verify a real non-root filesystem mount before creating the application
  // directory; otherwise mkdir could silently create it on the ephemeral root.
  const mount = findMount(dataDirectory);
  if (!mount || EPHEMERAL_FILESYSTEMS.has(mount.filesystem)) {
    throw new Error("[CRITICAL STORAGE GUARD] A dedicated persistent filesystem mount must cover UGOV_DATA_DIR before production startup.");
  }

  fs.mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dataDirectory, 0o700); } catch { /* best effort */ }

  const readiness = inspectStorageDirectory(dataDirectory);
  if (!readiness.persistentMountVerified) {
    throw new Error(`[CRITICAL STORAGE GUARD] Persistent storage readiness check failed: ${readiness.reason || "unknown error"}`);
  }
}
