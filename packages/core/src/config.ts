import type {
  AppConfig,
  DeepPartial,
} from './types.js';

/**
 * Default configuration used when none is provided.
 */
export const defaultConfig: AppConfig = {
  name: 'sajkatav',
  continueOnError: false,
  retries: 1,

  models: {
    orchestrator: 'gpt-4o',
    specGenerator: 'gpt-4o',
    coder: 'gpt-4o',
    tester: 'gpt-4o',
  },

  tester: {
    framework: 'vitest',
  },
} as const satisfies AppConfig;

/**
 * Define config with autocompletion. Merges with defaults.
 */
export function defineConfig(overrides: DeepPartial<AppConfig> = {}): AppConfig {
  return deepMerge(defaultConfig, overrides);
}

/** Deep merge two plain objects. */
function deepMerge<T>(base: T, over: DeepPartial<T>): T {
  if (!isObj(base) || !isObj(over)) {
    return (over ?? base) as T;
  }

  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(over)) {
    const baseVal = (base as Record<string, unknown>)[key];
    const overVal = (over as Record<string, unknown>)[key];
    if (isObj(baseVal) && isObj(overVal)) {
      result[key] = deepMerge(baseVal, overVal);
    } else if (overVal !== undefined) {
      result[key] = overVal;
    }
  }
  return result as T;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
