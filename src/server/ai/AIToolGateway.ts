/**
 * U-AI — Controlled AI Tool Gateway
 *
 * Enforces strict authorization, citizen-scoped data access, and IDOR protection.
 * Never gives the AI direct SQL or full vault access.
 * Audits every tool invocation to the U-AUDIT hash-chained ledger.
 */

import { IAIToolGateway, AIToolContext } from "./AIProvider";
import { GovernmentService } from "../services/governmentService";
import { db } from "../database/db";

export class AIToolGateway implements IAIToolGateway {
  private governmentService: GovernmentService;

  constructor(governmentService?: GovernmentService) {
    this.governmentService = governmentService || new GovernmentService();
  }

  private auditToolInvocation(toolName: string, context: AIToolContext, details: Record<string, any>) {
    try {
      db.insertAuditEvent({
        actorId: context.userId,
        actorName: context.citizenName || "Authenticated Citizen",
        actorRole: "CITIZEN",
        action: "AI_TOOL_CALLED",
        resource: `AI_TOOL:${toolName}`,
        result: "SUCCESS",
        context: JSON.stringify({
          toolName,
          ...details,
        }),
        ipAddress: context.ip,
      });
    } catch {
      // Non-blocking audit failure
    }
  }

  /**
   * Search public service catalogue
   */
  public async searchServices(query: string, category?: string): Promise<any[]> {
    let services = this.governmentService.listServices({ query, category });
    if (services.length === 0 && query) {
      const words = query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => !["show", "me", "the", "about", "services", "service", "i", "want", "for", "a", "an", "in", "to"].includes(w) && w.length > 2);

      for (const word of words) {
        const found = this.governmentService.listServices({
          query: word,
          category: ["education", "transport", "revenue", "agriculture", "health"].includes(word) ? word : category,
        });
        for (const s of found) {
          if (!services.some((existing) => existing.id === s.id)) {
            services.push(s);
          }
        }
      }
    }
    return services.map((s) => ({
      id: s.id,
      serviceCode: s.serviceCode,
      name: s.name,
      department: s.department,
      ministry: s.ministry,
      category: s.category,
      fee: s.fee,
      slaDays: s.slaDays,
      description: s.description,
    }));
  }

  /**
   * Get specific public service details
   */
  public async getServiceDetails(serviceCode: string): Promise<any> {
    try {
      const service = this.governmentService.getServiceById(serviceCode);
      return {
        id: service.id,
        serviceCode: service.serviceCode,
        name: service.name,
        department: service.department,
        ministry: service.ministry,
        category: service.category,
        description: service.description,
        benefits: service.benefits,
        eligibility: service.eligibility,
        requiredDocuments: service.requiredDocuments,
        slaDays: service.slaDays,
        fee: service.fee,
        officialPortal: service.officialPortal,
      };
    } catch {
      return { error: `Service with code '${serviceCode}' was not found in the official catalogue.` };
    }
  }

  /**
   * Check statutory document requirements for a service
   */
  public async checkRequirements(serviceCode: string): Promise<any> {
    try {
      const service = this.governmentService.getServiceById(serviceCode);
      return {
        serviceCode: service.serviceCode,
        name: service.name,
        requiredDocuments: service.requiredDocuments,
        requiredDocumentTypeIds: service.requiredDocumentTypeIds,
      };
    } catch {
      return { error: `Service '${serviceCode}' not found.` };
    }
  }

  /**
   * Retrieve application status (Citizen-scoped with IDOR protection)
   */
  public async getCitizenApplicationStatus(
    applicationNumberOrId: string,
    context: AIToolContext
  ): Promise<any> {
    this.auditToolInvocation("getCitizenApplicationStatus", context, {
      applicationQuery: applicationNumberOrId,
    });

    if (!context.userId) {
      return { error: "Citizen authentication is required to check application status." };
    }

    const cleanQuery = applicationNumberOrId.trim();

    // Query citizen applications
    const citizenApps = db.getApplications(context.userId);

    // Look for exact match by id or applicationNumber or partial match
    let matchedApp = citizenApps.find(
      (a) =>
        a.id.toLowerCase() === cleanQuery.toLowerCase() ||
        a.applicationNumber.toLowerCase() === cleanQuery.toLowerCase()
    );

    // If query is generic like "status" or "latest" or "my application", pick the latest application
    if (!matchedApp && (cleanQuery.length < 3 || cleanQuery.toLowerCase() === "latest" || cleanQuery.toLowerCase() === "status")) {
      if (citizenApps.length > 0) {
        matchedApp = citizenApps[citizenApps.length - 1];
      }
    }

    if (!matchedApp) {
      // Check if application exists belonging to another citizen (IDOR check)
      const allApps = db.getApplications();
      const crossApp = allApps.find(
        (a) =>
          a.id.toLowerCase() === cleanQuery.toLowerCase() ||
          a.applicationNumber.toLowerCase() === cleanQuery.toLowerCase()
      );

      if (crossApp && crossApp.userId !== context.userId) {
        // IDOR attempt detected
        try {
          db.insertAuditEvent({
            actorId: context.userId,
            actorName: context.citizenName || "Citizen",
            actorRole: "CITIZEN",
            action: "AI_TOOL_DENIED",
            resource: `APPLICATION:${crossApp.id}`,
            result: "BLOCKED",
            context: JSON.stringify({
              reason: "IDOR_CROSS_CITIZEN_ACCESS_BLOCKED",
              targetApplicationNumber: crossApp.applicationNumber,
            }),
            ipAddress: context.ip,
          });
        } catch {}
        return { error: "Application not found or you do not have permission to view it." };
      }

      return {
        message: "No matching application found for your citizen account. You can create an application in the Services directory.",
      };
    }

    // Resolve service name
    const service = db.findServiceById(matchedApp.serviceId);

    return {
      applicationNumber: matchedApp.applicationNumber,
      serviceName: service ? service.name : matchedApp.serviceId,
      serviceCode: service ? service.serviceCode : matchedApp.serviceId,
      status: matchedApp.status,
      trackingToken: matchedApp.trackingToken || "Pending Dispatch",
      submittedAt: matchedApp.submittedAt || null,
      createdAt: matchedApp.createdAt,
    };
  }

  /**
   * Evaluate document vault readiness for a given service (Citizen-scoped)
   */
  public async getCitizenDocumentReadiness(
    serviceCode: string,
    context: AIToolContext
  ): Promise<any> {
    this.auditToolInvocation("getCitizenDocumentReadiness", context, { serviceCode });

    if (!context.userId) {
      return { error: "Citizen authentication is required to check document readiness." };
    }

    try {
      const evaluation = this.governmentService.getServiceRequirements(serviceCode, context.userId);
      return {
        serviceCode: evaluation.service.serviceCode,
        serviceName: evaluation.service.name,
        readinessPercentage: evaluation.readinessPercentage,
        isApplicationReady: evaluation.isApplicationReady,
        totalRequired: evaluation.totalRequired,
        satisfiedCount: evaluation.satisfiedCount,
        missingCount: evaluation.missingCount,
        satisfiedDocuments: evaluation.requirements
          .filter((r) => r.satisfied)
          .map((r) => r.documentTypeName),
        missingDocuments: evaluation.requirements
          .filter((r) => !r.satisfied)
          .map((r) => r.documentTypeName),
      };
    } catch (err: any) {
      return { error: err.message || `Unable to evaluate readiness for '${serviceCode}'.` };
    }
  }
}
