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
import { searchFaqKnowledge } from "../routes/faq";
import {
  GENERIC_DOMAIN_TOKENS,
  MIN_SERVICE_RELEVANCE_SCORE,
  scoreWeightedFields,
  tokenizeSearchQuery,
} from "./retrieval";

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
   * Search public service catalogue using whole-word weighted scoring and
   * minimum relevance thresholds so unrelated queries never return random services.
   */
  public async searchServices(query: string, category?: string): Promise<any[]> {
    const cleanQuery = (query || "").trim();
    const tokens = tokenizeSearchQuery(cleanQuery);
    const allServices = this.governmentService.listServices({ category });

    // If caller explicitly filters by category with an empty query, return category list
    if (!cleanQuery && category && category !== "all") {
      return allServices.map((s) => ({
        id: s.id,
        serviceCode: s.serviceCode,
        name: s.name,
        department: s.department,
        ministry: s.ministry,
        category: s.category,
        fee: s.fee,
        slaDays: s.slaDays,
        description: s.description,
        relevanceScore: MIN_SERVICE_RELEVANCE_SCORE,
        matchedTerms: [category],
      }));
    }

    if (!tokens.length) {
      return [];
    }

    // If the user explicitly asked to browse all services (only generic tokens like "government services")
    const hasSpecificToken = tokens.some((t) => !GENERIC_DOMAIN_TOKENS.has(t));
    if (!hasSpecificToken) {
      return [];
    }

    const scored = allServices
      .map((s) => {
        const result = scoreWeightedFields(
          cleanQuery,
          tokens,
          s.name,
          [
            { text: s.name, weight: 6 },
            { text: s.serviceCode, weight: 6 },
            { text: s.category, weight: 5 },
            { text: s.department, weight: 3 },
            { text: s.ministry, weight: 2 },
            { text: s.description, weight: 2 },
            { text: (s.eligibility || []).join(" "), weight: 1 },
          ],
          [s.serviceCode, s.serviceCode.replace(/-/g, " ")]
        );
        return { s, result };
      })
      .filter(({ result }) => result.rawScore >= MIN_SERVICE_RELEVANCE_SCORE)
      .sort((a, b) => b.result.rawScore - a.result.rawScore);

    // If the top match is a strong title/code match, suppress weaker accidental body-only matches
    const topScore = scored[0]?.result.rawScore ?? 0;
    const filtered =
      scored[0]?.result.titleMatched && topScore >= 7
        ? scored.filter(({ result }) => result.titleMatched || result.rawScore >= topScore - 2)
        : scored;

    return filtered.map(({ s, result }) => ({
      id: s.id,
      serviceCode: s.serviceCode,
      name: s.name,
      department: s.department,
      ministry: s.ministry,
      category: s.category,
      fee: s.fee,
      slaDays: s.slaDays,
      description: s.description,
      relevanceScore: result.rawScore,
      matchedTerms: result.matchedTerms,
    }));
  }

  /**
   * Search public U-GOV help content and FAQs with optional category filter.
   * This dataset contains no citizen records.
   */
  public async searchKnowledge(query: string, allowedCategories?: string[]): Promise<any[]> {
    return searchFaqKnowledge(query, allowedCategories);
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
