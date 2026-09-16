export function isHarvestCycleWriteAllowed(
  explicitFlagValue: string | undefined,
  targetSafetyErrors: readonly string[],
): boolean {
  if (targetSafetyErrors.length > 0) return false

  // Keep existing environments operational during the flag rollout, while
  // treating every explicitly configured non-true value as a kill switch.
  if (explicitFlagValue === undefined) return true
  return explicitFlagValue.trim().toLowerCase() === "true"
}
