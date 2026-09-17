/**
 * Source-controlled approval for Coconut Counting Harvested writes.
 *
 * Production deliberately ships the exact reviewed marker below as a
 * Production-only adaptation of the Preview-approved source. Runtime
 * environment values cannot supply or alter this source approval.
 */
export const COCONUT_COUNTING_PRODUCTION_WRITE_APPROVAL =
  "APPROVE_MFMS_COCONUT_COUNTING_HARVESTED_WRITES_V1" as const

/** Source-controlled approval for audited Cycle/Plot session assignments. */
export const COCONUT_COUNTING_SESSION_ASSIGNMENT_PRODUCTION_WRITE_APPROVAL =
  "APPROVE_MFMS_COCONUT_COUNTING_SESSION_ASSIGNMENT_WRITES_V1" as const
