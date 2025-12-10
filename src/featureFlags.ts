/**
 * Basic implementation of feature flags to enable development
 * on experimental features that should not be included in
 * production releases.
 */
export const FeatureFlags = {
  ArgoCDMCP: 'mcp-for-argocd'
} as const;

// Create a type for the possible flag names
export type FeatureFlagName = typeof FeatureFlags[keyof typeof FeatureFlags];

/**
 * Enable the feature flags here
 */
const userFeatureFlags: Record<FeatureFlagName, boolean> = {
  [FeatureFlags.ArgoCDMCP]: false
};

/**
 * Returns whether a specific feature is enabled.
 *
 * @param flagName The flag to check
 * @returns
 */
export function isFeatureEnabled(flagName: FeatureFlagName): boolean {
  return userFeatureFlags[flagName] || false;
}
