export type CaptureKind = 'single' | 'strip'

export interface FilterPreset {
  id: string
  label: string
  css: string
}

export interface Photo {
  id: string
  user_id: string
  storage_path: string
  url: string
  kind: CaptureKind
  created_at: string
}

export interface CapturedFrame {
  dataUrl: string
  width: number
  height: number
}
