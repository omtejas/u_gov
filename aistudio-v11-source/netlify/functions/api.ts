import serverless from "serverless-http";
import { app } from "../../server";

// Adapts the existing Express API to Netlify's serverless function runtime.
// API requests are redirected here by netlify.toml.
export const handler = serverless(app);
