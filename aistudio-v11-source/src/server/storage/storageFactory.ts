import type { StorageDriver } from "./StorageDriver";
import { LocalStorageDriver } from "./LocalStorageDriver";
import { S3CompatibleStorageDriver } from "./S3CompatibleStorageDriver";

let defaultDriver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (!defaultDriver) {
    const storageType = (process.env.UGOV_STORAGE_TYPE || "local").toLowerCase();
    if (storageType === "s3") {
      defaultDriver = new S3CompatibleStorageDriver();
    } else if (storageType === "local") {
      defaultDriver = new LocalStorageDriver();
    } else {
      throw new Error(`Unsupported UGOV_STORAGE_TYPE '${storageType}'. Expected 'local' or 's3'.`);
    }
  }
  return defaultDriver;
}

export function setStorageDriver(driver: StorageDriver): void {
  defaultDriver = driver;
}
