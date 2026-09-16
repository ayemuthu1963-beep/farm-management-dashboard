/**
 * Source-controlled approval for Coconut Counting Harvested writes.
 *
 * Production deliberately ships the exact reviewed marker below as a
 * Production-only adaptation of the Preview-approved source. Runtime
 * environment values cannot supply or alter this source approval.
 */
export const COCONUT_COUNTING_PRODUCTION_WRITE_APPROVAL =
  "APPROVE_MFMS_COCONUT_COUNTING_HARVESTED_WRITES_V1" as const
