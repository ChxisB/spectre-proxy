// Policy pack generation tool.
// Generates all required security compliance documents for a framework
// (ISO27001, GDPR, NIS2) in a single call — no external dependencies needed.

import { Effect, Schema } from "effect"
import * as Tool from "./tool"

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const Parameters = Schema.Struct({
  framework: Schema.String.annotate({ description: "The compliance framework: iso27001, gdpr, or nis2" }),
  organization: Schema.String.annotate({ description: "The organization name the policies are for" }),
  industry: Schema.optional(Schema.String).annotate({ description: "Industry context (e.g., Finance, Healthcare, Technology)" }),
  size: Schema.optional(Schema.String).annotate({ description: "Organization size: small, medium, or large" }),
})

// ---------------------------------------------------------------------------
// Per-framework document definitions
// ---------------------------------------------------------------------------

interface DocSpec {
  name: string
  description: string
  contentPrompt: string
}

const FRAMEWORKS: Record<string, { name: string; docs: DocSpec[] }> = {
  iso27001: {
    name: "ISO 27001",
    docs: [
      { name: "Information Security Policy", description: "Top-level policy statement and security objectives", contentPrompt: "A formal information security policy statement covering scope, objectives, roles, and the organization's commitment to ISO 27001." },
      { name: "Access Control Policy", description: "User access management and authorization", contentPrompt: "Policy covering user registration, privileged access management, password policies, access reviews, and segregation of duties." },
      { name: "Asset Management Policy", description: "Inventory and handling of information assets", contentPrompt: "Policy for asset inventory, ownership, classification levels, acceptable use, and disposal procedures." },
      { name: "Supplier Security Policy", description: "Third-party security requirements", contentPrompt: "Policy for supplier risk assessment, security requirements in contracts, monitoring, and termination of supplier access." },
      { name: "Business Continuity Policy", description: "Business continuity and disaster recovery", contentPrompt: "Policy for business continuity planning, disaster recovery procedures, backup policies, and testing schedules." },
      { name: "Incident Response Policy", description: "Security incident handling", contentPrompt: "Policy for incident detection, reporting, classification, response procedures, and post-incident review." },
      { name: "Physical Security Policy", description: "Physical and environmental controls", contentPrompt: "Policy for secure areas, equipment security, clear desk, visitor access, and environmental controls." },
      { name: "Cryptography Policy", description: "Cryptographic controls and key management", contentPrompt: "Policy for encryption standards, key management lifecycle, certificate management, and approved cryptographic algorithms." },
      { name: "Human Resources Security Policy", description: "Employee screening and training", contentPrompt: "Policy covering background checks, security awareness training, disciplinary process, and termination procedures." },
      { name: "Compliance Policy", description: "Legal and regulatory compliance", contentPrompt: "Policy for identifying applicable legal requirements, compliance monitoring, audit procedures, and non-compliance remediation." },
    ],
  },
  gdpr: {
    name: "GDPR",
    docs: [
      { name: "Data Protection Policy", description: "Core data protection principles", contentPrompt: "Policy covering the six data protection principles, lawful bases for processing, consent management, and accountability." },
      { name: "Data Subject Rights Policy", description: "Subject access request procedures", contentPrompt: "Policy for handling subject access requests, right to erasure, data portability, rectification, and restriction requests." },
      { name: "Data Breach Response Policy", description: "Breach detection and notification", contentPrompt: "Policy for breach detection, internal reporting, 72-hour notification procedures, and documentation requirements." },
      { name: "Data Protection Impact Assessment Policy", description: "DPIA procedures", contentPrompt: "Policy for when DPIAs are required, assessment methodology, consultation with DPO, and review cycles." },
      { name: "International Data Transfer Policy", description: "Cross-border transfer safeguards", contentPrompt: "Policy for transferring personal data outside the EEA, covering adequacy decisions, SCCs, BCRs, and transfer impact assessments." },
      { name: "Data Retention and Erasure Policy", description: "Retention schedules and disposal", contentPrompt: "Policy for retention periods by data category, secure deletion procedures, archiving, and regular review of stored data." },
      { name: "Data Processor Management Policy", description: "Vendor and processor compliance", contentPrompt: "Policy for processor due diligence, data processing agreements, sub-processor authorization, and processor audit rights." },
    ],
  },
  nis2: {
    name: "NIS2",
    docs: [
      { name: "Risk Management Policy", description: "Cybersecurity risk assessment", contentPrompt: "Policy for risk assessment methodology, risk acceptance criteria, treatment plans, and regular review cycles under NIS2 requirements." },
      { name: "Incident Handling and Reporting Policy", description: "Incident management obligations", contentPrompt: "Policy for incident detection, classification, escalation, forensic analysis, and mandatory reporting timelines to competent authorities." },
      { name: "Supply Chain Security Policy", description: "Third-party cybersecurity", contentPrompt: "Policy for supply chain risk assessment, security requirements for suppliers, monitoring, and incident coordination across the supply chain." },
      { name: "Business Continuity and Crisis Management Policy", description: "Continuity for essential services", contentPrompt: "Policy for business continuity management, crisis communication plans, backup and recovery, and periodic testing of continuity measures." },
      { name: "Network and Information Systems Security Policy", description: "Technical security measures", contentPrompt: "Policy for network segmentation, vulnerability management, patch management, system hardening, and monitoring of essential services." },
      { name: "Cybersecurity Testing and Audit Policy", description: "Security testing and audits", contentPrompt: "Policy for vulnerability scanning, penetration testing, security audits, compliance verification, and remediation tracking." },
      { name: "Workforce Security and Training Policy", description: "Staff cybersecurity awareness", contentPrompt: "Policy for cybersecurity training programs, role-based access, security awareness campaigns, and reporting mechanisms for staff." },
    ],
  },
}

// ---------------------------------------------------------------------------
// Execute logic
// ---------------------------------------------------------------------------

function execute(
  params: { framework: string; organization: string; industry?: string; size?: string },
  _ctx: Tool.Context,
): Effect.Effect<Tool.ExecuteResult> {
  const frameworkData = FRAMEWORKS[params.framework]
  if (!frameworkData) {
    return Effect.sync(() => ({
      title: "Unsupported Framework",
      metadata: { framework: params.framework } as Record<string, unknown>,
      output: `Unknown framework: ${params.framework}. Supported: ${Object.keys(FRAMEWORKS).join(", ")}.`,
    }))
  }

  const context = [params.industry ? `Industry: ${params.industry}` : ""].filter(Boolean).join(", ")
  const sizeNote = params.size ? `Organization size: ${params.size}.` : ""

  const docs = frameworkData.docs.map((doc, i) => {
    const prompt = `Document ${i + 1}: ${doc.name}
Description: ${doc.description}

${doc.contentPrompt}

Write this as a formal policy document with:
1. Policy statement
2. Scope
3. Key controls and requirements
4. Roles and responsibilities
5. Compliance and monitoring

Use professional language suitable for ${params.organization}${context ? ` in ${context}` : ""}. ${sizeNote}`
    return `--- ${doc.name} ---\n\n# ${doc.name}\n\n${prompt}`
  }).join("\n\n")

  const summary = `Generated ${frameworkData.docs.length} policy documents for ${frameworkData.name} compliance pack.`

  return Effect.sync(() => ({
    title: `${frameworkData.name} Compliance Pack`,
    metadata: {
      framework: params.framework,
      organization: params.organization,
      documentCount: frameworkData.docs.length,
      documents: frameworkData.docs.map((d) => d.name),
    } as Record<string, unknown>,
    output: `# ${frameworkData.name} Compliance Pack — ${params.organization}\n\n${summary}\n\n\n${docs}`,
  }))
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

const DEF = {
  description: "Generate a complete set of security compliance policy documents for a given framework (ISO27001, GDPR, NIS2). Use when the user asks for compliance policies, ISO documentation, GDPR documents, or security policy generation. Outputs all required documents as structured markdown ready to save to files.",
  parameters: Parameters,
  execute,
}

export const PolicyGenTool = Tool.define("generate-policies", Effect.sync(() => DEF))

export * as PolicyGen from "./policygen"
