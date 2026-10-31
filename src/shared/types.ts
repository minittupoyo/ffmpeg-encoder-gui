export type VideoCodec = 'h264' | 'h265' | 'av1' | 'vp9'
export type Container = 'mp4' | 'mkv' | 'webm' | 'mp3' | 'm4a'

export type HwAccel = 'none' | 'nvenc' | 'qsv' | 'amf'

export interface EncodeSettings {
  presetId: string
  /** 映像エンコーダの種別。コーデックが未対応の場合はソフトウェアにフォールバックする */
  hwAccel: HwAccel
  /** 'copy' 以外の映像コーデック。null は映像なし(-vn) */
  videoCodec: VideoCodec | null
  audioCodec: 'aac' | 'libopus' | 'libmp3lame'
  crf: number
  /** 高さ(px)。null で元のまま */
  height: number | null
  fps: number | null
  audioBitrateK: number
  container: Container
}

export interface EncodeRequest {
  id: string
  input: string
  outDir: string | null
  settings: EncodeSettings
}

export interface EncodeResult {
  status: 'done' | 'error' | 'canceled'
  code: number | null
}

export interface Preset {
  id: string
  label: string
  settings: Omit<EncodeSettings, 'presetId' | 'hwAccel'>
}
