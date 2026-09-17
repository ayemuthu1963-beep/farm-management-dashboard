type HarvestCycleWriteRuntime = {
  MFMS_ENV?: string
  NEXT_PUBLIC_MFMS_ENV?: string
  NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL?: string
  MFMS_BUILD_ENVIRONMENT?: string
  MFMS_GIT_COMMIT?: string
}

type HarvestCycleWriteGateInput = {
  explicitFlagValue: string | undefined
  targetSafetyErrors: readonly string[]
  sourceProductionApproval: string
  runtime: HarvestCycleWriteRuntime
}

export const REQUIRED_PRODUCTION_WRITE_APPROVAL =
  "APPROVE_MFMS_COCONUT_COUNTING_HARVESTED_WRITES_V1" as const
export const REQUIRED_PRODUCTION_SESSION_ASSIGNMENT_APPROVAL =
  "APPROVE_MFMS_COCONUT_COUNTING_SESSION_ASSIGNMENT_WRITES_V1" as const

const EXACT_GIT_COMMIT = /^[0-9a-f]{40}$/

function hasExactReleaseIdentity(
  runtime: HarvestCycleWriteRuntime,
  expected: {
    serverEnvironment: string
    publicEnvironment: string
    databaseLabel: string
    buildEnvironment: string
  },
): boolean {
  // The deployment controllers authoritatively inject MFMS_ENV,
  // MFMS_BUILD_ENVIRONMENT, and MFMS_GIT_COMMIT. Public build metadata is
  // checked when present, but is not required because the Production
  // controller does not itself guarantee those optional keys.
  const publicEnvironmentMatches = runtime.NEXT_PUBLIC_MFMS_ENV === undefined
    || runtime.NEXT_PUBLIC_MFMS_ENV === expected.publicEnvironment
  const databaseLabelMatches = runtime.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL === undefined
    || runtime.NEXT_PUBLIC_MFMS_ENV_DATABASE_LABEL === expected.databaseLabel
  return runtime.MFMS_ENV === expected.serverEnvironment
    && publicEnvironmentMatches
    && databaseLabelMatches
    && runtime.MFMS_BUILD_ENVIRONMENT === expected.buildEnvironment
    && EXACT_GIT_COMMIT.test(runtime.MFMS_GIT_COMMIT ?? "")
}

export function isHarvestCycleWriteAllowed({
  explicitFlagValue,
  targetSafetyErrors,
  sourceProductionApproval,
  runtime,
}: HarvestCycleWriteGateInput): boolean {
  if (targetSafetyErrors.length > 0) return false

  // An absent flag supports the controlled Preview rollout. Any configured
  // value other than true is an explicit kill switch in every environment.
  if (
    explicitFlagValue !== undefined
    && explicitFlagValue.trim().toLowerCase() !== "true"
  ) {
    return false
  }

  const isExactPreview = hasExactReleaseIdentity(runtime, {
    serverEnvironment: "preview",
    publicEnvironment: "preview",
    databaseLabel: "mfms_server_uat",
    buildEnvironment: "Preview",
  })
  const isExactUat = hasExactReleaseIdentity(runtime, {
    serverEnvironment: "uat",
    publicEnvironment: "uat",
    databaseLabel: "mfms_server_uat",
    buildEnvironment: "Preview",
  })
  if (isExactPreview || isExactUat) return true

  const isExactProduction = hasExactReleaseIdentity(runtime, {
    serverEnvironment: "production",
    publicEnvironment: "production",
    databaseLabel: "mfms_server_prod",
    buildEnvironment: "Production",
  })
  return isExactProduction
    && sourceProductionApproval === REQUIRED_PRODUCTION_WRITE_APPROVAL
}

export function isSessionAssignmentWriteAllowed({
  explicitFlagValue,
  targetSafetyErrors,
  sourceProductionApproval,
  runtime,
}: HarvestCycleWriteGateInput): boolean {
  if (targetSafetyErrors.length > 0) return false
  if (
    explicitFlagValue !== undefined
    && explicitFlagValue.trim().toLowerCase() !== "true"
  ) {
    return false
  }

  const isExactPreview = hasExactReleaseIdentity(runtime, {
    serverEnvironment: "preview",
    publicEnvironment: "preview",
    databaseLabel: "mfms_server_uat",
    buildEnvironment: "Preview",
  })
  const isExactUat = hasExactReleaseIdentity(runtime, {
    serverEnvironment: "uat",
    publicEnvironment: "uat",
    databaseLabel: "mfms_server_uat",
    buildEnvironment: "Preview",
  })
  if (isExactPreview || isExactUat) return true

  const isExactProduction = hasExactReleaseIdentity(runtime, {
    serverEnvironment: "production",
    publicEnvironment: "production",
    databaseLabel: "mfms_server_prod",
    buildEnvironment: "Production",
  })
  return isExactProduction
    && sourceProductionApproval === REQUIRED_PRODUCTION_SESSION_ASSIGNMENT_APPROVAL
}
