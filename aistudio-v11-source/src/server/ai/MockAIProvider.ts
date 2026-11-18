/**
 * U-AI — Deterministic Mock AI Provider
 *
 * Provides a local, zero-credential AI engine for development, testing,
 * and reliable offline execution.
 * Grounded in verified U-SERVICES, U-DOCS, and U-GOV Local Knowledge facts.
 */

import {
  AIProvider,
  AIChatRequest,
  AIChatResponse,
  IAIToolGateway,
  AIToolResult,
} from "./AIProvider";
import {
  classifyAIIntentWithHistory,
  isPrivateContextualFollowup,
} from "./AIIntentRouter";
import { searchGlossaryEntries } from "./localKnowledge";

export class MockAIProvider implements AIProvider {
  public readonly providerName = "MockAIProvider";

  public async generateResponse(
    request: AIChatRequest,
    toolGateway: IAIToolGateway
  ): Promise<AIChatResponse> {
    const q = request.message.toLowerCase().trim();
    const history = request.conversationHistory || [];
    const intent = classifyAIIntentWithHistory(request.message, history);
    const toolCalls: AIToolResult[] = [];
    const timestamp = new Date().toISOString();
    const disclaimer = "AI-generated guidance. Verify important information before submission.";

    // 0. Citizen Greetings & Introductions (never recommend services unsolicited)
    if (intent === "GREETING") {
      return {
        reply: `Namaste! I am **Bharat G-Bot**, your U-GOV Public Services & Platform Assistant.\n\nI can assist you with:\n• **Service Discovery**: Ask about scholarships, driving licences, domicile certificates, income certificates, PM-KISAN, or Ayushman Bharat.\n• **Document Requirements & Vault Readiness**: Ask what documents are needed or *"Am I ready for scholarship?"* when signed in.\n• **Application Tracking**: Ask *"Where is my application?"* to track submitted services.\n• **Platform & Developer Guidance**: Ask about DigiVault, Consent Center, or using/building with U-GOV.\n\nHow can I help you today?`,
        source: "U-GOV National AI Public Services Engine (MockAIProvider)",
        intent,
        retrieval: {
          intent,
          candidatesEvaluated: 0,
          serviceSearchAllowed: false,
          faqSearchAllowed: false,
          knowledgeMatches: [],
          serviceMatches: [],
          faqMatches: [],
          suppressedIrrelevant: true,
        },
        suggestions: [
          "Find scholarships for college students",
          "How do I renew a driving licence?",
          "How can I use U-GOV as a developer?",
          "Check my application status",
        ],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // Only an explicit follow-up to the citizen's own previous request is handled locally.
    if (isPrivateContextualFollowup(request.message, history)) {
      return {
        reply: "I can explain the status without sending your application details outside U-GOV. DRAFT means the application has not been submitted; DOCUMENTS_REQUIRED means required items are missing; READY means the checklist is satisfied; CONSENT_REQUIRED means you must authorize the requested document sharing; SUBMITTED or PROCESSING means the sandbox workflow has received the demo application; ACTION_REQUIRED means you need to review the Tracker for the next step; APPROVED or REJECTED are terminal demo outcomes. Open Tracker to see the exact action recorded for your application.",
        source: "U-GOV private application guidance",
        intent: "PRIVATE_CITIZEN_WORKFLOW",
        suggestions: ["Open my application in Tracker", "Explain the document checklist", "How does consent work?"],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 1. Application Status Query
    if (
      intent === "PRIVATE_CITIZEN_WORKFLOW" &&
      (q.includes("status") || q.includes("track") || q.includes("where is my application") ||
        q.match(/ugov-\d{4}-[a-z-]+-[a-f0-9]+/i) || q.match(/app-\d+/i))
    ) {
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
          intent,
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
          intent,
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
        intent,
        suggestions: ["Refresh Application Status", "View in Tracker", "What are the next steps?"],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 2. Document Readiness Query
    if (
      intent === "PRIVATE_CITIZEN_WORKFLOW" &&
      (q.includes("ready") || q.includes("missing") ||
        (q.includes("document") && (q.includes("have") || q.includes("my") || q.includes("check"))))
    ) {
      let targetCode = "NSP";
      if (q.includes("driving") || q.includes("licence") || q.includes("sarathi")) targetCode = "SARATHI-DL";
      else if (q.includes("domicile") || q.includes("residence")) targetCode = "DOMICILE-CERT";
      else if (q.includes("income")) targetCode = "INCOME-CERT";
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
          intent,
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
        intent,
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
    if (intent === "GOVERNMENT_SERVICE" && (q.includes("scholarship") || q.includes("nsp"))) {
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
        intent,
        suggestions: ["Check My Readiness for NSP", "Apply for Scholarship", "List Required Documents"],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 4. Service Discovery Query: Driving Licence
    if (intent === "GOVERNMENT_SERVICE" && (q.includes("driving") || q.includes("licence") || q.includes("license") || q.includes("sarathi") || q.includes("rto"))) {
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
        intent,
        suggestions: ["Check My Readiness for Driving Licence", "Apply for DL Renewal", "Find Nearest RTO"],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 5. Service Discovery Query: Domicile Certificate
    if (intent === "GOVERNMENT_SERVICE" && (q.includes("domicile") || q.includes("residence") || q.includes("adivas"))) {
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
        intent,
        suggestions: ["Check My Readiness for Domicile", "Apply for Domicile Certificate", "Explain Domicile Certificate"],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 6. Generic Service Search (strictly gated to GOVERNMENT_SERVICE)
    if (intent === "GOVERNMENT_SERVICE") {
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
          intent,
          suggestions: searchResults.slice(0, 3).map((s) => `Tell me about ${s.serviceCode}`),
          toolCalls,
          disclaimer,
          timestamp,
        };
      }
    }

    // 7. Verified Local Knowledge for Developer, Navigation, Document/Application Guidance, and Conceptual/Civic Queries
    const glossaryMatches = searchGlossaryEntries(request.message, intent);
    if (glossaryMatches.length > 0) {
      const top = glossaryMatches[0].entry;
      const lines = [
        `### 📚 ${top.title}`,
        "",
        top.simpleExplanation,
        "",
        `• **Practical example**: ${top.realLifeExample}`,
      ];
      if (top.keyHighlights && top.keyHighlights.length > 0) {
        for (const h of top.keyHighlights) lines.push(`• ${h}`);
      }
      if (top.documentsNeeded && top.documentsNeeded.length > 0) {
        lines.push(`• **Typical documents needed**: ${top.documentsNeeded.join(", ")}`);
      }
      if (top.whereToGetIt) lines.push(`• **Where / Portal**: ${top.whereToGetIt}`);

      return {
        reply: lines.join("\n"),
        source: "U-GOV Verified Local Knowledge (Offline Demo)",
        intent,
        citations: top.officialUrl
          ? [{ title: top.title, url: top.officialUrl, snippet: top.simpleExplanation, sourceType: "u-gov" }]
          : [],
        suggestions:
          intent === "DEVELOPER_GUIDANCE"
            ? ["What technology stack does U-GOV use?", "How does Bharat G-Bot work?", "What can U-GOV help me do?"]
            : ["Explore U-GOV Services Directory", "What can U-GOV help me do?", "Check my application status"],
        toolCalls,
        disclaimer,
        timestamp,
      };
    }

    // 8. Honest offline response when nothing matched.
    return {
      reply: "General AI answers are unavailable in offline demo mode. I can still help with supported U-GOV service discovery, developer documentation, verified civic glossary terms, and secure citizen workflows.",
      source: "U-GOV offline demo assistant",
      intent,
      suggestions: [
        "Find scholarships for college students",
        "How can I use U-GOV as a developer?",
        "How do I check my application status?",
      ],
      toolCalls,
      disclaimer,
      timestamp,
    };
  }
}
