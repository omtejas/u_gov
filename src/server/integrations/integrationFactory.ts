import { IntegrationAdapter } from "./IntegrationAdapter";
import { SandboxIntegrationAdapter } from "./SandboxIntegrationAdapter";

let activeAdapter: IntegrationAdapter = new SandboxIntegrationAdapter();

export function getIntegrationAdapter(): IntegrationAdapter {
  return activeAdapter;
}

export function setIntegrationAdapter(adapter: IntegrationAdapter): void {
  activeAdapter = adapter;
}
