import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { authenticate } from "./src/server/middleware/auth";
import { authRouter } from "./src/server/routes/auth";
import { documentsRouter } from "./src/server/routes/documents";
import { servicesRouter } from "./src/server/routes/services";
import { applicationsRouter } from "./src/server/routes/applications";
import { integrationsRouter } from "./src/server/routes/integrations";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.disable("x-powered-by");

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(express.json({ limit: "10mb" }));

// Apply session authentication middleware
app.use(authenticate as any);

// Mount U-IDENTITY and U-AUDIT routes
app.use("/api/v1/auth", authRouter);

// Mount U-DOCS and U-CONSENT routes
app.use("/api/v1/documents", documentsRouter);

// Mount U-SERVICES Public Service Catalogue routes
app.use("/api/v1/services", servicesRouter);

// Mount U-APPLICATIONS Lifecycle Engine routes
app.use("/api/v1/applications", applicationsRouter);

// Mount U-INTEGRATIONS Adapter & Gateway routes (Phase 5)
app.use("/api/v1/integrations", integrationsRouter);

// Initialize Gemini lazily
let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAI && process.env.GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "u-gov-sovereign-dpi",
          },
        },
      });
    } catch (e) {
      console.warn("Notice: GoogleGenAI initialization skipped:", e);
    }
  }
  return genAI;
}

// 1. Health Telemetry Endpoint
app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "U-GOV National Unified Governance Platform",
    dpiVersion: "3.2-production-ready",
    aiEngineActive: Boolean(process.env.GEMINI_API_KEY),
  });
});

// 2. Bharat G-Bot AI Assistant Endpoint
app.post("/api/v1/ai/chat", async (req: Request, res: Response) => {
  const { message, language = "en", conversationHistory = [] } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const cleanMessage = message.trim();
  const ai = getGenAI();

  if (ai) {
    try {
      const systemInstruction = `You are Bharat G-Bot, the Sovereign AI Public Services Assistant of U-GOV India (Unified Governance & Citizen Services Platform).
Your mission is to guide Indian citizens regarding central & state schemes, eligibility rules, required documents, and grievance redressals with zero hallucination.
Format answers clearly:
1. Direct Crisp Summary (1-2 lines)
2. Eligibility & Benefits (Amounts in ₹, key parameters)
3. Action Plan (Step 1, 2, 3)
4. Required Documents Checklist
5. Official Portals (e.g. scholarships.gov.in, pmkisan.gov.in, parivahan.gov.in, uidai.gov.in).`;

      const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

      if (Array.isArray(conversationHistory)) {
        for (const item of conversationHistory) {
          if (!item.text) continue;
          contents.push({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: item.text }],
          });
        }
      }

      contents.push({ role: "user", parts: [{ text: cleanMessage }] });

      const geminiPromise = ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: { systemInstruction, temperature: 0.5 },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini API call timed out")), 7000)
      );

      const response: any = await Promise.race([geminiPromise, timeoutPromise]);

      if (response && response.text) {
        return res.json({
          reply: response.text.trim(),
          source: "Gemini-2.5-Flash (U-GOV Sovereign Reasoning)",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.warn("Gemini query fallback engaged:", err?.message || err);
    }
  }

  // Authoritative Offline Fallback Knowledge Engine
  const fallback = resolveFallbackAnswer(cleanMessage);
  return res.json({
    reply: fallback.text,
    source: fallback.source,
    suggestions: fallback.suggestions,
    timestamp: new Date().toISOString(),
  });
});

// 3. Terminology Explainer Endpoint
app.post("/api/v1/ai/explain", async (req: Request, res: Response) => {
  const { term } = req.body;
  if (!term || typeof term !== "string") {
    return res.status(400).json({ error: "Term parameter is required" });
  }

  const cleanTerm = term.toLowerCase().trim();

  const glossary: Record<string, any> = {
    domicile: {
      simpleExplanation: "A Domicile Certificate is official proof that you have resided in a particular State continuously for 10-15 years.",
      realLifeExample: "Required when applying for state engineering/medical college seats under local state quota.",
      whyGovernmentAsks: "To ensure state benefits reach genuine residents of that state.",
      whereToGetIt: "Tehsildar Office, Citizen Service Center (CSC), or State Seva Portal.",
      documentsNeeded: ["Aadhaar Card", "Ration Card or Electricity Bill (10+ yrs)", "School Leaving Certificate", "Affidavit"],
      issuingAuthority: "Sub-Divisional Magistrate (SDM) / Tehsildar",
    },
    "non-creamy layer": {
      simpleExplanation: "An official certificate showing your family's annual income is below the OBC Creamy Layer limit (currently ₹8 Lakh/year).",
      realLifeExample: "If your family earns ₹4.5 Lakh/year, this proves you qualify for OBC quota reservation benefits.",
      whyGovernmentAsks: "To ensure reservation benefits reach families in genuine financial need.",
      whereToGetIt: "Revenue Department or District Magistrate Office.",
      documentsNeeded: ["Caste Certificate", "Income Certificate for last 3 years", "Form 16 / ITR", "Aadhaar Card"],
      issuingAuthority: "Revenue Officer / SDO",
    },
    mutation: {
      simpleExplanation: "Land Mutation (Ferfar / Dakhil Kharij) is the official transfer of ownership title in government revenue records after buying land.",
      realLifeExample: "Updates the government land ledger so property tax notices are billed to the new buyer.",
      whyGovernmentAsks: "To maintain an accurate public record of legal land ownership.",
      whereToGetIt: "Talathi / Patwari Office or State Bhulekh online portal.",
      documentsNeeded: ["Registered Sale Deed", "Previous 7/12 Extract", "Identity Proof", "Affidavit"],
      issuingAuthority: "Tehsildar / Land Records Department",
    },
  };

  const matchKey = Object.keys(glossary).find((k) => cleanTerm.includes(k)) || "domicile";
  return res.json({
    success: true,
    term: cleanTerm,
    explanation: glossary[matchKey],
  });
});

function resolveFallbackAnswer(query: string) {
  const q = query.toLowerCase();

  if (q.includes("aadhaar") || q.includes("uidai")) {
    return {
      text: `### 🔍 Aadhaar Citizen Resolution Guide (Simulation):\n\n1. **📱 Update Mobile Number**: Visit your nearest Aadhaar Seva Kendra or Post Office. No document proof needed; only biometric verification is performed. Updated within 24-48 hours.\n2. **🏠 Change Address Online**: Use myAadhaar portal with electricity bill, rent agreement, or Head of Family (HoF) consent.\n3. **🔒 Biometric Lock/Unlock**: Lock fingerprints on myAadhaar for instant privacy protection.\n\n📞 **UIDAI Toll-Free Helpline**: 1947 | Portal: myaadhaar.uidai.gov.in`,
      source: "Unique Identification Authority of India (UIDAI Reference)",
      suggestions: ["How to unlock biometrics?", "Download masked e-Aadhaar", "Find nearest Aadhaar Kendra"],
    };
  }

  if (q.includes("scholarship") || q.includes("nsp") || q.includes("student")) {
    return {
      text: `### 🎓 National Scholarship Portal (NSP) Guide:\n\n1. **Benefits**: 100% tuition waiver + up to ₹50,000/year maintenance allowance for hostellers.\n2. **Key Criteria**: Family income below ₹8 LPA, minimum 50% in previous exam.\n3. **Documents**: Aadhaar, Bonafide Student Certificate, Previous Marksheet, Income Certificate.\n\n👉 *You can apply directly via U-GOV with pre-verified DigiVault credentials.*`,
      source: "Ministry of Education (NSP Reference)",
      suggestions: ["Check Scholarship Eligibility", "Required Documents for NSP", "Track NSP Application"],
    };
  }

  if (q.includes("kisan") || q.includes("farmer") || q.includes("pm-kisan")) {
    return {
      text: `### 🌾 PM-KISAN Samman Nidhi Guide:\n\n1. **Direct Benefit**: ₹6,000 per year transferred in 3 equal installments of ₹2,000 via DBT.\n2. **Mandatory Steps**: Complete Aadhaar e-KYC on the PM-Kisan portal and verify land record seeding.\n3. **Kisan Credit Card (KCC)**: Subsidized 4% interest loans up to ₹3 Lakh for inputs.\n\n📞 *Kisan Call Center: 1800-180-1551 (Toll-Free, 24x7).*`,
      source: "Ministry of Agriculture & Farmers Welfare",
      suggestions: ["Check PM-Kisan e-KYC Status", "Apply for Kisan Credit Card", "Check APMC Mandi Rates"],
    };
  }

  return {
    text: `Namaste! I am Bharat G-Bot, your 24/7 sovereign AI public services assistant.\n\nI can assist you with:\n• **Discover Schemes**: Scholarship matching, PM-KISAN, Ayushman Bharat, PMAY housing, and Mudra loans.\n• **Certificates**: Step-by-step guidance on Domicile, Non-Creamy Layer, 7/12 extracts, and Caste certificates.\n• **Status Tracking**: Track your applications across Central and State ministries.\n\nWhat public service or scheme can I help you with?`,
    source: "U-GOV National AI Public Services Engine",
    suggestions: ["What schemes am I eligible for?", "How to apply for Driving Licence", "Explain Domicile Certificate"],
  };
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[U-GOV Sovereign DPI Platform] Server running on http://localhost:${PORT}`);
  });
}

startServer();
