/**
 * Vercel Edge Config — ultra-fast key-value reads at the edge.
 *
 * Use for: feature flags, maintenance mode, A/B testing, rollout percentages,
 * and other values that need to be read instantly without hitting the database.
 *
 * The EDGE_CONFIG env var is set in .env:
 *   EDGE_CONFIG=https://edge-config.vercel.com/ecfg_xxx?token=yyy
 *
 * Reads are cached at the edge (global CDN) — typically <10ms latency.
 * Updates are made via the Vercel dashboard or API (not from the app).
 */

import { get } from '@vercel/edge-config';

/** Check if Edge Config is available (env var set) */
export function isEdgeConfigAvailable(): boolean {
  return !!process.env.EDGE_CONFIG;
}

/**
 * Get a value from Edge Config.
 * Returns `defaultValue` if Edge Config is not configured or the key doesn't exist.
 *
 * @example
 * const maintenanceMode = await getEdgeValue<boolean>('maintenance_mode', false);
 * const maxRegistrations = await getEdgeValue<number>('max_registrations', 32);
 */
export async function getEdgeValue<T>(key: string, defaultValue: T): Promise<T> {
  try {
    if (!isEdgeConfigAvailable()) return defaultValue;
    const value = await get<T>(key);
    return value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Check if maintenance mode is enabled via Edge Config.
 * This can be toggled instantly from the Vercel dashboard without redeploying.
 */
export async function isMaintenanceMode(): Promise<boolean> {
  return getEdgeValue<boolean>('maintenance_mode', false);
}

/**
 * Get the registration capacity for a division.
 * Can be changed at the edge without database queries or redeployment.
 */
export async function getRegistrationCapacity(): Promise<number> {
  return getEdgeValue<number>('registration_capacity', 16);
}

/**
 * Check if a specific feature flag is enabled.
 */
export async function isFeatureEnabled(flag: string): Promise<boolean> {
  return getEdgeValue<boolean>(`feature_${flag}`, false);
}

/**
 * Get all feature flags as a record.
 * Expects Edge Config key "features" to be a Record<string, boolean>.
 */
export async function getAllFeatureFlags(): Promise<Record<string, boolean>> {
  return getEdgeValue<Record<string, boolean>>('features', {});
}
