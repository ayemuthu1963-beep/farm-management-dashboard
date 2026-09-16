/**
 * Source-controlled approval for Coconut Counting Harvested writes.
 *
 * Preview deliberately ships the disabled marker below. A Production release
 * must replace it with the exact token required by the write gate as an
 * explicitly reviewed Production-only adaptation. Runtime environment values
 * cannot turn this marker into a Production approval.
 */
export const COCONUT_COUNTING_PRODUCTION_WRITE_APPROVAL =
  "PREVIEW_SOURCE_POLICY__PRODUCTION_HARVESTED_WRITES_DISABLED" as const
