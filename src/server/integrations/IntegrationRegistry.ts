import { IntegrationAdapter, ProviderInfo } from "./IntegrationAdapter";
import { SandboxIntegrationAdapter } from "./SandboxIntegrationAdapter";

export class IntegrationRegistry {
  private static instance: IntegrationRegistry;
  private adapters: Map<string, IntegrationAdapter> = new Map();
  private serviceToProviderMap: Map<string, string> = new Map();
  private defaultAdapter: IntegrationAdapter;

  private constructor() {
    // 1. Instantiate standard Sandbox adapters for known statutory services
    const nspAdapter = new SandboxIntegrationAdapter(
      "SANDBOX_NSP",
      "National Scholarship Portal (Sandbox Gateway)",
      ["NSP", "SCHOLARSHIP-PRE", "SCHOLARSHIP-POST"],
      "mock://bharat-bus.internal/nsp"
    );

    const sarathiAdapter = new SandboxIntegrationAdapter(
      "SANDBOX_SARATHI",
      "MoRTH Sarathi Transport Gateway (Sandbox)",
      ["SARATHI-DL", "SARATHI-LL", "VEHICLE-REG"],
      "mock://bharat-bus.internal/sarathi"
    );

    const mahadbtAdapter = new SandboxIntegrationAdapter(
      "SANDBOX_MAHADBT",
      "Government of Maharashtra MahaDBT Gateway (Sandbox)",
      ["DOMICILE-CERT", "INCOME-CERT", "CASTE-CERT", "NON-CREAMY-LAYER"],
      "mock://bharat-bus.internal/mahadbt"
    );

    const defaultSandbox = new SandboxIntegrationAdapter(
      "SANDBOX_DEFAULT",
      "U-GOV General Bharat e-Services Bus (Sandbox)",
      ["*"],
      "mock://bharat-bus.internal/default"
    );

    this.defaultAdapter = defaultSandbox;

    this.registerAdapter(nspAdapter);
    this.registerAdapter(sarathiAdapter);
    this.registerAdapter(mahadbtAdapter);
    this.registerAdapter(defaultSandbox);
  }

  public static getInstance(): IntegrationRegistry {
    if (!IntegrationRegistry.instance) {
      IntegrationRegistry.instance = new IntegrationRegistry();
    }
    return IntegrationRegistry.instance;
  }

  public registerAdapter(adapter: IntegrationAdapter): void {
    const info = adapter.getProviderInfo();
    this.adapters.set(info.providerCode, adapter);

    for (const service of info.supportedServices) {
      this.serviceToProviderMap.set(service.toUpperCase(), info.providerCode);
    }
  }

  public getAdapterByCode(providerCode: string): IntegrationAdapter | undefined {
    return this.adapters.get(providerCode);
  }

  public getAdapterForService(serviceCode: string): IntegrationAdapter {
    const code = (serviceCode || "").toUpperCase();
    const providerCode = this.serviceToProviderMap.get(code);

    if (providerCode && this.adapters.has(providerCode)) {
      return this.adapters.get(providerCode)!;
    }

    return this.defaultAdapter;
  }

  public listProviders(): ProviderInfo[] {
    return Array.from(this.adapters.values()).map((a) => a.getProviderInfo());
  }

  public setDefaultAdapter(adapter: IntegrationAdapter): void {
    this.defaultAdapter = adapter;
    this.registerAdapter(adapter);
  }
}

export const integrationRegistry = IntegrationRegistry.getInstance();
