import { StorageDriver } from "./StorageDriver";
import { LocalStorageDriver } from "./LocalStorageDriver";

let defaultDriver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (!defaultDriver) {
    // In future cloud deployments, switch between S3 / GCS / Local based on STORAGE_TYPE env var
    defaultDriver = new LocalStorageDriver();
  }
  return defaultDriver;
}

export function setStorageDriver(driver: StorageDriver): void {
  defaultDriver = driver;
}
