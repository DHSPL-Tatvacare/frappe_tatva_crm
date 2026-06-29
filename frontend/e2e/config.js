// Single source for environment-derived E2E config. Nothing is hardcoded or fabricated — each value
// comes from an env var, with a clear error when a required one is missing (see e2e/README.md).
export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080'
export const STORAGE_STATE = 'e2e/.auth/state.json'
export const CSRF_FILE = 'e2e/.auth/csrf.json'

export function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`E2E: missing required env var ${name} — see e2e/README.md`)
  return v
}

// Optional seeded row for read-only navigation tests; a spec that needs it skips when unset (never fabricate).
export const SEEDED_LEAD = process.env.E2E_LEAD || ''
