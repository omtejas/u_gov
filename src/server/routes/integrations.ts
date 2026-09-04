import { Router, Request, Response } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { integrationRegistry } from "../integrations/IntegrationRegistry";
import { applicationService } from "../services/applicationService";

export const integrationsRouter = Router();

/**
 * All integration management endpoints require authentication.
 */
integrationsRouter.use(requireAuth);

/**
 * GET /api/v1/integrations/providers
 * Returns catalogue of registered sandbox adapters, environments, and statutory capabilities.
 */
integrationsRouter.get("/providers", (_req: AuthenticatedRequest, res: Response) => {
  try {
    const providers = integrationRegistry.listProviders();
    return res.json({
      success: true,
      total: providers.length,
      environment: "SANDBOX",
      providers,
      disclaimer: "Sandbox Simulation only. No connection made to live government systems.",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to list providers.",
    });
  }
});

/**
 * GET /api/v1/integrations/providers/:code/health
 * Probes the health status and latency of a specific integration adapter.
 */
integrationsRouter.get("/providers/:code/health", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adapter = integrationRegistry.getAdapterByCode(req.params.code.toUpperCase());
    if (!adapter) {
      return res.status(404).json({
        success: false,
        error: `Provider '${req.params.code}' not found in registry.`,
      });
    }

    const health = await adapter.healthCheck();
    return res.json({
      success: true,
      health,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to perform health check.",
    });
  }
});

/**
 * GET /api/v1/applications/:id/integration
 * Inspect normalized integration state and telemetry for a citizen's application.
 * Strictly protected against IDOR.
 */
integrationsRouter.get("/applications/:id", (req: AuthenticatedRequest, res: Response) => {
  try {
    const integrationData = applicationService.getApplicationIntegration(
      req.params.id,
      req.user!.id
    );
    return res.json({
      success: true,
      ...integrationData,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to retrieve application integration telemetry.",
    });
  }
});

/**
 * POST /api/v1/applications/:id/integration/status
 * Explicitly polls upstream departmental adapter to refresh status.
 */
integrationsRouter.post("/applications/:id/status", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statusResult = await applicationService.pollIntegrationStatus(
      req.params.id,
      req.user!.id,
      req.ip
    );

    return res.json({
      success: true,
      status: statusResult,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to poll integration status.",
    });
  }
});
