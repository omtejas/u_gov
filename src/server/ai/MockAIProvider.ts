/**
 * U-AI — Deterministic Mock AI Provider
 *
 * Provides a local, zero-credential AI engine for development, testing,
 * and reliable offline execution.
 * Grounded in verified U-SERVICES facts and citizen-scoped tool gateway data.
 */

import {
  AIProvider,
  AIChatRequest,
  AIChatResponse,
  IAIToolGateway,
  AIToolResult,
} from "./AIProvider";

export class MockAIProvider implements AIProvider {
  public readonly providerName = "MockAIProvider";

  public async generateResponse(
    request: AIChatRequest,
    toolGateway: IAIToolGateway
  ): Promise<AIChatResponse> {
    const q = request.message.toLowerCase().trim();
    const toolCalls: AIToolResult[] = [];
    const timestamp = new Date().toISOString();
    const disclaimer = "AI-generated guidance. Verify important information before submission.";

    // 0. Citizen Greetings & Introductions
    if (
      q === "hello" ||
      q === "hi" ||
      q === "namaste" ||
      q.startsWith("hello") ||
      q.startsWith("hi ") ||
      q.startsWith("namaste") ||
      q.includes("who are you") ||
      q.includes("help me")
    ) {
      return {
        reply: `Namaste! I am **Bharat G-Bot**, your Sovereign AI Public Services Guide.\n\nI can assist you with:\n• **Service Discovery**: Ask about scholarships, driving licences, domicile certificates, PM-KISAN, or Ayushman Bharat.\n• **Document Requirements**: Ask what documents are required for any government service.\n• **Vault Readiness**: Ask *"Am I ready for scholarship?"* to evaluate your U-DOCS vault.\n• **Application Tracking**: Ask *"Where is my application?"* to track submitted services.\n\nHow can I help you today?`,
        source: "U-GOV National AI Public Services Engine (MockAIProvider)",
        suggestions: [
          "What scholarships can I apply for?",
          "Driving licence documents required",
          "Check my application status",
          "Am I ready for scholarship?",
        ],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 1. Application Status Query
    if (
      q.includes("status") ||
      q.includes("track") ||
      q.includes("where is my application") ||
      q.match(/ugov-\d{4}-[a-z-]+-[a-f0-9]+/i) ||
      q.match(/app-\d+/i)
    ) {
      // Extract application number or ID if present
      const appMatch = q.match(/(ugov-\d{4}-[a-z0-9-]+|app-\d+-[a-f0-9]+)/i);
      const appQuery = appMatch ? appMatch[0] : "latest";

      const statusResult = await toolGateway.getCitizenApplicationStatus(appQuery, request.context);
      toolCalls.push({
        toolName: "getCitizenApplicationStatus",
        success: !statusResult.error,
        data: statusResult,
      });

      if (statusResult.error) {
        return {
          reply: `### 🔍 Application Status Verification\n\n${statusResult.error}\n\nPlease check your application number in the **Tracker** or verify you are signed into the correct citizen account.`,
          source: "U-GOV Application Tracking Engine",
          suggestions: ["View My Applications in Tracker", "Explore Available Services", "Contact Helpdesk"],
          toolCalls,
          disclaimer,
          timestamp,
        };
      }

      if (statusResult.message) {
        return {
          reply: `### 📋 Application Records\n\n${statusResult.message}`,
          source: "U-GOV Application Tracking Engine",
          suggestions: ["Explore Services Directory", "Check National Scholarship Portal", "Upload Documents to Vault"],
          toolCalls,
          disclaimer,
          timestamp,
        };
      }

      const reply = `### 📋 Application Status: ${statusResult.applicationNumber}

• **Service**: ${statusResult.serviceName} (${statusResult.serviceCode})
• **Current Lifecycle State**: \`${statusResult.status}\`
• **Tracking Token**: \`${statusResult.trackingToken}\`
• **Created**: ${new Date(statusResult.createdAt).toLocaleDateString()}
${statusResult.submittedAt ? `• **Submitted**: ${new Date(statusResult.submittedAt).toLocaleDateString()}` : "• **Action**: Documents or consent pending submission"}

You can inspect the full lifecycle history and integration gateway telemetry in the **Tracker** tab.`;

      return {
        reply,
        source: "U-GOV Application Tracking Engine",
        suggestions: ["Refresh Application Status", "View in Tracker", "What are the next steps?"],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 2. Document Readiness Query
    if (
      q.includes("ready") ||
      q.includes("missing") ||
      (q.includes("document") && (q.includes("have") || q.includes("my") || q.includes("check")))
    ) {
      let targetCode = "NSP";
      if (q.includes("driving") || q.includes("licence") || q.includes("sarathi")) targetCode = "SARATHI-DL";
      else if (q.includes("domicile") || q.includes("residence")) targetCode = "DOMICILE-CERT";
      else if (q.includes("kisan") || q.includes("farmer")) targetCode = "PM-KISAN";
      else if (q.includes("ayushman") || q.includes("health")) targetCode = "AYUSHMAN-CARD";

      const readiness = await toolGateway.getCitizenDocumentReadiness(targetCode, request.context);
      toolCalls.push({
        toolName: "getCitizenDocumentReadiness",
        success: !readiness.error,
        data: readiness,
      });

      if (readiness.error) {
        return {
          reply: `### 📄 Vault Readiness Assessment\n\n${readiness.error}`,
          source: "U-DOCS Requirement Evaluator",
          suggestions: ["Go to Sovereign Vault", "Explore Services Directory"],
          toolCalls,
          disclaimer,
          timestamp,
        };
      }

      const satisfiedList = readiness.satisfiedDocuments.length > 0
        ? readiness.satisfiedDocuments.map((d: string) => `  ✓ **${d}** (Verified in Vault)`).join("\n")
        : "  *(No matching verified documents currently attached)*";

      const missingList = readiness.missingDocuments.length > 0
        ? readiness.missingDocuments.map((d: string) => `  ✗ **${d}** (Missing — upload to U-DOCS)`).join("\n")
        : "  *(All required documents are satisfied!)*";

      const reply = `### 📊 Sovereign Vault Readiness: ${readiness.serviceName}

• **Readiness Score**: **${readiness.readinessPercentage}%** (${readiness.satisfiedCount}/${readiness.totalRequired} documents satisfied)
• **Application Ready**: ${readiness.isApplicationReady ? "✅ **YES — You can proceed with submission**" : "⚠️ **NO — Action required**"}

**Verified in Vault:**
${satisfiedList}

**Missing Documents:**
${missingList}

${
  readiness.isApplicationReady
    ? "👉 You have satisfied all prerequisites. You can apply directly through the **Services Hub**."
    : "👉 Please upload the missing document(s) to your **Sovereign Vault (U-DOCS)** to achieve 100% readiness."
}`;

      return {
        reply,
        source: "U-DOCS Requirement Evaluator",
        suggestions: [
          readiness.isApplicationReady ? `Apply for ${readiness.serviceCode}` : "Upload Document to Vault",
          "Check Required Documents",
          "Back to Services Directory",
        ],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 3. Service Discovery Query: Scholarship
    if (q.includes("scholarship") || q.includes("nsp") || q.includes("student") || q.includes("college")) {
      const details = await toolGateway.getServiceDetails("NSP");
      toolCalls.push({
        toolName: "getServiceDetails",
        success: !details.error,
        data: details,
      });

      const reply = `### 🎓 National Scholarship Portal (NSP) — Higher Education DBT

${details.description || "Direct Benefit Transfer (DBT) for pre-matric, post-matric, and merit-based national scholarships."}

• **Ministry**: ${details.ministry} (${details.department})
• **Statutory SLA**: ${details.slaDays} working days | **Fee**: ₹${details.fee} (Free)
• **Official Portal**: [${details.officialPortal}](${details.officialPortal})

**Eligibility Criteria:**
${(details.eligibility || []).map((e: string) => `• ${e}`).join("\n")}

**Statutory Document Checklist:**
${(details.requiredDocuments || []).map((d: string) => `• ${d}`).join("\n")}

**Benefits:**
${(details.benefits || []).map((b: string) => `• ${b}`).join("\n")}`;

      return {
        reply,
        source: "U-SERVICES National Catalogue",
        suggestions: ["Check My Readiness for NSP", "Apply for Scholarship", "List Required Documents"],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 4. Service Discovery Query: Driving Licence
    if (q.includes("driving") || q.includes("licence") || q.includes("sarathi") || q.includes("rto")) {
      const details = await toolGateway.getServiceDetails("SARATHI-DL");
      toolCalls.push({
        toolName: "getServiceDetails",
        success: !details.error,
        data: details,
      });

      const reply = `### 🚗 Driving Licence Renewal & Endorsement — Sarathi MoRTH

${details.description || "Renewal, duplicate issuance, and address change for motor vehicle driving licences across Indian States."}

• **Ministry**: ${details.ministry} (${details.department})
• **Statutory SLA**: ${details.slaDays} working days | **Statutory Fee**: ₹${details.fee}
• **Official Portal**: [${details.officialPortal}](${details.officialPortal})

**Eligibility:**
${(details.eligibility || []).map((e: string) => `• ${e}`).join("\n")}

**Required Documents:**
${(details.requiredDocuments || []).map((d: string) => `• ${d}`).join("\n")}`;

      return {
        reply,
        source: "U-SERVICES National Catalogue",
        suggestions: ["Check My Readiness for Driving Licence", "Apply for DL Renewal", "Find Nearest RTO"],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 5. Service Discovery Query: Domicile Certificate
    if (q.includes("domicile") || q.includes("residence") || q.includes("adivas")) {
      const details = await toolGateway.getServiceDetails("DOMICILE-CERT");
      toolCalls.push({
        toolName: "getServiceDetails",
        success: !details.error,
        data: details,
      });

      const reply = `### 📜 State Domicile & Age/Nationality Certificate

${details.description || "Official certificate proving continuous residence within the State for education quotas and public employment."}

• **Department**: ${details.department}
• **Statutory SLA**: ${details.slaDays} working days | **Statutory Fee**: ₹${details.fee}
• **Official Portal**: [${details.officialPortal}](${details.officialPortal})

**Required Documents:**
${(details.requiredDocuments || []).map((d: string) => `• ${d}`).join("\n")}`;

      return {
        reply,
        source: "U-SERVICES Maharashtra State Catalogue",
        suggestions: ["Check My Readiness for Domicile", "Apply for Domicile Certificate", "Explain Domicile Certificate"],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 6. Generic Service Search
    const searchResults = await toolGateway.searchServices(request.message);
    if (searchResults.length > 0) {
      toolCalls.push({
        toolName: "searchServices",
        success: true,
        data: { count: searchResults.length },
      });

      const listStr = searchResults
        .slice(0, 3)
        .map(
          (s) =>
            `• **${s.name}** (\`${s.serviceCode}\`)\n  ${s.description}\n  *Department*: ${s.department} | *SLA*: ${s.slaDays} days | *Fee*: ₹${s.fee}`
        )
        .join("\n\n");

      return {
        reply: `### 🏛️ Matched Government Services\n\nFound **${searchResults.length}** service(s) matching your inquiry:\n\n${listStr}\n\nAsk for any specific service code to view full eligibility and document checklists.`,
        source: "U-SERVICES National Catalogue",
        suggestions: searchResults.slice(0, 3).map((s) => `Tell me about ${s.serviceCode}`),
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 7. General Fallback Guidance
    return {
      reply: `Namaste! I am **Bharat G-Bot**, your Sovereign AI Public Services Guide.\n\nI can assist you with:\n• **Service Discovery**: Ask about scholarships, driving licences, domicile certificates, PM-KISAN, or Ayushman Bharat.\n• **Document Requirements**: Ask what documents are required for any government service.\n• **Vault Readiness**: Ask *"Am I ready for scholarship?"* to evaluate your U-DOCS vault.\n• **Application Tracking**: Ask *"Where is my application?"* to track submitted services.\n\nHow can I help you today?`,
      source: "U-GOV National AI Public Services Engine (MockAIProvider)",
      suggestions: [
        "What scholarships can I apply for?",
        "Driving licence documents required",
        "Check my application status",
        "Am I ready for scholarship?",
      ],
      toolCalls,
      disclaimer,
      timestamp,
    };
  }
}
