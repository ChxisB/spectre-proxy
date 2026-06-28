import { Effect, Schema } from "effect"
import {
  type Member,
  AGENT_ELIGIBILITY_REGISTRY,
  CategoryMember as CategoryMemberSchema,
  SubagentTypeMember as SubagentTypeMemberSchema,
  MemberValidationError,
  AgentNotEligibleError,
  MemberCountError,
} from "./types"

/**
 * Validate that a subagent type is eligible for team membership.
 * Fails with AgentNotEligibleError for hard-reject and conditional agents.
 */
export function validateMemberEligibility(
  subagentType: string,
): Effect.Effect<void, AgentNotEligibleError> {
  const entry = AGENT_ELIGIBILITY_REGISTRY[subagentType]
  if (!entry) {
    // Unknown agents are treated as eligible (they may be user-defined)
    return Effect.void
  }

  switch (entry.verdict) {
    case "eligible":
      return Effect.void
    case "conditional":
      return Effect.fail(
        new AgentNotEligibleError({
          agentType: subagentType,
          message: entry.rejectionMessage
            ?? `Agent "${subagentType}" is conditionally eligible but requires additional configuration.`,
        }),
      )
    case "hard-reject":
      return Effect.fail(
        new AgentNotEligibleError({
          agentType: subagentType,
          message: entry.rejectionMessage
            ?? `Agent "${subagentType}" cannot be a team member. Use task/delegate-task instead.`,
        }),
      )
  }
}

/**
 * Infer the member kind from the input data.
 * Auto-detects based on which identifying field is present.
 */
export function inferMemberKind(
  input: Record<string, unknown>,
): "category" | "subagent_type" | undefined {
  if (input.category && typeof input.category === "string") return "category"
  if (input.subagentType && typeof input.subagentType === "string") return "subagent_type"
  return undefined
}

/**
 * Parse and validate a single member from raw input.
 * Auto-detects the member kind if not explicitly set.
 */
export function parseMember(
  input: unknown,
): Effect.Effect<Member, MemberValidationError> {
  const raw = input as Record<string, unknown>

  // Auto-detect kind if not present
  if (!raw.kind || typeof raw.kind !== "string") {
    const inferred = inferMemberKind(raw)
    if (inferred) {
      raw.kind = inferred
    } else {
      return Effect.fail(
        new MemberValidationError({
          name: String(raw.name ?? "unknown"),
          issue:
            'Cannot determine member kind. Specify either "category" or "subagent_type".',
        }),
      )
    }
  }

  // Parse based on kind
  if (raw.kind === "category") {
    return Schema.decodeUnknownEffect(CategoryMemberSchema)(raw).pipe(
      Effect.mapError(
        (parseError) =>
          new MemberValidationError({
            name: String(raw.name ?? "unknown"),
            issue: `Invalid category member: ${parseError.message}`,
          }),
      ),
    )
  }

  if (raw.kind === "subagent_type") {
    return Schema.decodeUnknownEffect(SubagentTypeMemberSchema)(raw).pipe(
      Effect.mapError(
        (parseError) =>
          new MemberValidationError({
            name: String(raw.name ?? "unknown"),
            issue: `Invalid subagent_type member: ${parseError.message}`,
          }),
      ),
    )
  }

  return Effect.fail(
    new MemberValidationError({
      name: String(raw.name ?? "unknown"),
      issue: `Unknown member kind: ${raw.kind}. Expected "category" or "subagent_type".`,
    }),
  )
}

/**
 * Parse an array of members, validating each one.
 */
export function parseMembers(
  members: unknown[],
): Effect.Effect<Member[], MemberValidationError | MemberCountError> {
  if (members.length < 1) {
    return Effect.fail(
      new MemberCountError({
        count: members.length,
        max: 8,
        min: 1,
      }),
    )
  }

  if (members.length > 8) {
    return Effect.fail(
      new MemberCountError({
        count: members.length,
        max: 8,
        min: 1,
      }),
    )
  }

  return Effect.forEach(
    members,
    (member: unknown) => parseMember(member),
  )
}

/**
 * Check for duplicate member names in a parsed member list.
 */
export function findDuplicateNames(members: Member[]): string[] {
  const names = members.map((m) => m.name)
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const name of names) {
    if (seen.has(name)) {
      duplicates.add(name)
    }
    seen.add(name)
  }

  return Array.from(duplicates)
}
