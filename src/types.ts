export type CaptureKind = 'single' | 'strip'

export interface FilterPreset {
  id: string
  label: string
  css: string
}

export interface Photo {
  id: string
  /** The owner's Cognito identity ID (not the User Pool sub). */
  userId: string
  /** S3 object key, `<identityId>/<id>.jpg`. The public URL is derived from this. */
  storageKey: string
  kind: CaptureKind
  createdAt: string
}

export interface CapturedFrame {
  dataUrl: string
  width: number
  height: number
}

export interface AuthUser {
  sub: string
  email: string
}
