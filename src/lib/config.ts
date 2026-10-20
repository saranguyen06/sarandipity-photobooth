// Runtime configuration.
//
// The AWS resource IDs (user pool, bucket, table...) don't exist until the CDK
// stack is deployed, so they can't be baked into the build. Instead, the CDK
// stack writes a small `config.json` next to the app on CloudFront, and the
// app fetches it once at startup, before anything renders.
//
// For `npm run dev`, download the deployed copy into `public/config.json`
// (see README) and Vite will serve it from the same path.

export interface AppConfig {
  region: string
  userPoolId: string
  userPoolClientId: string
  identityPoolId: string
  photosBucket: string
  photosTable: string
  /** Base URL of the CloudFront distribution, e.g. https://d123.cloudfront.net */
  cdnUrl: string
}

const REQUIRED_KEYS: (keyof AppConfig)[] = [
  'region',
  'userPoolId',
  'userPoolClientId',
  'identityPoolId',
  'photosBucket',
  'photosTable',
  'cdnUrl',
]

let config: AppConfig | null = null

export async function loadConfig(): Promise<AppConfig> {
  if (config) return config

  let data: unknown
  try {
    const res = await fetch('/config.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // If the file is missing, SPA hosts (Vite dev server, CloudFront error
    // responses) answer with index.html instead of a 404, and .json() throws.
    data = await res.json()
  } catch {
    throw new Error(
      'Could not load /config.json. When running locally, download it from your deployed site into public/config.json (see README).'
    )
  }

  const record = data as Record<string, unknown>
  const missing = REQUIRED_KEYS.filter((key) => typeof record?.[key] !== 'string')
  if (missing.length > 0) {
    throw new Error(`config.json is missing or has invalid fields: ${missing.join(', ')}`)
  }

  config = record as unknown as AppConfig
  return config
}

/** Synchronous accessor, valid once loadConfig() has resolved (main.tsx guarantees this). */
export function getConfig(): AppConfig {
  if (!config) throw new Error('Config accessed before loadConfig() finished.')
  return config
}

/** Public URL for a saved photo. Photos are served through CloudFront, not directly from S3. */
export function photoUrl(storageKey: string): string {
  return `${getConfig().cdnUrl}/photos/${storageKey}`
}
