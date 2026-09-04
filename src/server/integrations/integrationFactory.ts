import { IntegrationAdapter } from "./IntegrationAdapter";
import { integrationRegistry } from "./IntegrationRegistry";

export function getIntegrationAdapter(serviceCode?: string): IntegrationAdapter {
  if (serviceCode) {
    return integrationRegistry.getAdapterForService(serviceCode);
  }
  return integrationRegistry.getAdapterForService("*");
}

export function setIntegrationAdapter(adapter: IntegrationAdapter): void {
  integrationRegistry.setDefaultAdapter(adapter);
}
