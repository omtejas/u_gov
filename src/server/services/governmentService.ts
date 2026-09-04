import { db, GovernmentServiceRecord, CitizenDocumentRecord } from "../database/db";

export interface RequirementEvaluationItem {
  documentTypeId: string;
  documentTypeName: string;
  issuingAuthority: string;
  satisfied: boolean;
  matchedDocument?: {
    id: string;
    title: string;
    documentNumber: string;
    fileName: string;
    sha256Checksum: string;
    verificationStatus: string;
    createdAt: string;
  };
}

export interface ServiceRequirementsEvaluation {
  service: {
    id: string;
    serviceCode: string;
    name: string;
    department: string;
  };
  totalRequired: number;
  satisfiedCount: number;
  missingCount: number;
  isApplicationReady: boolean;
  readinessPercentage: number;
  requirements: RequirementEvaluationItem[];
}

export class GovernmentService {
  /**
   * List public government services with optional filtering & search
   */
  public listServices(options: {
    category?: string;
    query?: string;
    state?: string;
  } = {}): GovernmentServiceRecord[] {
    return db.getServices(options.category, options.query, options.state);
  }

  /**
   * Retrieve distinct categories with counts of available services
   */
  public getServiceCategories(): { category: string; count: number }[] {
    const services = db.getServices();
    const map = new Map<string, number>();
    for (const s of services) {
      map.set(s.category, (map.get(s.category) || 0) + 1);
    }
    return Array.from(map.entries()).map(([category, count]) => ({ category, count }));
  }

  /**
   * Retrieve single service by unique ID or service short code
   */
  public getServiceById(
    idOrCode: string,
    requestingUserId?: string,
    ip?: string
  ): GovernmentServiceRecord {
    let service = db.findServiceById(idOrCode);
    if (!service) {
      service = db.findServiceByCode(idOrCode);
    }

    if (!service) {
      const err: any = new Error(`Government service not found: "${idOrCode}".`);
      err.statusCode = 404;
      throw err;
    }

    // Emit audit event if accessed by an authenticated citizen
    if (requestingUserId) {
      const profile = db.getProfileByUserId(requestingUserId);
      db.recordAuditEvent({
        id: `aud-${Date.now()}-servview`,
        timestamp: new Date().toISOString(),
        actorId: requestingUserId,
        actorName: profile?.displayName || "Citizen",
        actorRole: "Citizen",
        action: "SERVICE_VIEWED",
        resource: `Service ${service.name} (${service.serviceCode})`,
        result: "SUCCESS",
        context: `Citizen inspected service specification and requirements catalogue for ${service.department}.`,
        ipAddress: ip,
      });
    }

    return service;
  }

  /**
   * Phase 4.3 Service Requirement Engine:
   * Dynamically evaluates service requirements against citizen's private U-DOCS vault
   */
  public getServiceRequirements(
    serviceIdOrCode: string,
    citizenUserId: string,
    ip?: string
  ): ServiceRequirementsEvaluation {
    const service = this.getServiceById(serviceIdOrCode);
    const citizenDocs = db.getDocumentsByOwner(citizenUserId);
    const documentTypes = db.getDocumentTypes();

    const requirements: RequirementEvaluationItem[] = (service.requiredDocumentTypeIds || []).map((typeId) => {
      const docType = documentTypes.find((dt) => dt.id === typeId);
      const matched = citizenDocs.find((d) => d.documentTypeId === typeId);

      return {
        documentTypeId: typeId,
        documentTypeName: docType?.name || typeId,
        issuingAuthority: docType?.issuingAuthority || "Competent Authority",
        satisfied: Boolean(matched),
        matchedDocument: matched
          ? {
              id: matched.id,
              title: matched.title,
              documentNumber: matched.documentNumber,
              fileName: matched.fileName,
              sha256Checksum: matched.sha256Checksum,
              verificationStatus: matched.verificationStatus,
              createdAt: matched.createdAt,
            }
          : undefined,
      };
    });

    const totalRequired = requirements.length;
    const satisfiedCount = requirements.filter((r) => r.satisfied).length;
    const missingCount = totalRequired - satisfiedCount;
    const isApplicationReady = missingCount === 0;
    const readinessPercentage = totalRequired > 0 ? Math.round((satisfiedCount / totalRequired) * 100) : 100;

    // Emit audit event
    const profile = db.getProfileByUserId(citizenUserId);
    db.recordAuditEvent({
      id: `aud-${Date.now()}-servreq`,
      timestamp: new Date().toISOString(),
      actorId: citizenUserId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "SERVICE_REQUIREMENTS_CHECKED",
      resource: `Service ${service.name} (${service.serviceCode})`,
      result: "SUCCESS",
      context: `Prerequisite evaluation: ${satisfiedCount}/${totalRequired} documents satisfied in private vault. Readiness: ${readinessPercentage}%.`,
      ipAddress: ip,
    });

    return {
      service: {
        id: service.id,
        serviceCode: service.serviceCode,
        name: service.name,
        department: service.department,
      },
      totalRequired,
      satisfiedCount,
      missingCount,
      isApplicationReady,
      readinessPercentage,
      requirements,
    };
  }
}

export const governmentService = new GovernmentService();
