export type VideoCodec = 'h264' | 'h265' | 'av1' | 'vp9'
export type Container = 'mp4' | 'mkv' | 'webm' | 'mp3' | 'm4a'

export type HwAccel = 'none' | 'nvenc' | 'qsv' | 'amf'
/** quality: CRF/CQ による品質指定、bitrate: 目標ビットレート指定 */
export type RateControl = 'quality' | 'bitrate'
export type PixFmt = 'auto' | 'yuv420p' | 'yuv420p10le'
export type AudioMode = 'encode' | 'copy' | 'none'
/** drop: 字幕を含めない、copy: 全字幕トラックをコンテナに合わせて格納、burn: 映像に焼き込む */
export type SubtitleMode = 'drop' | 'copy' | 'burn'

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
  /** エンコード速度プリセット。null はエンコーダの既定値 */
  speed: string | null
  rateControl: RateControl
  videoBitrateK: number
  pixFmt: PixFmt
  /** mp4 / m4a で moov を先頭に置く(-movflags +faststart) */
  faststart: boolean
  audioMode: AudioMode
  /** null で元のまま */
  audioChannels: 1 | 2 | 6 | null
  sampleRate: 44100 | 48000 | null
  subtitleMode: SubtitleMode
  /** 焼き込む入力内字幕トラックの番号(0 始まり) */
  subtitleTrack: number
  /** 焼き込み字幕のフォントサイズ。null で字幕側の指定に従う */
  subtitleFontSize: number | null
  /** true でメタデータとチャプターを引き継がない */
  stripMetadata: boolean
  /** 出力の直前に追加する ffmpeg 引数(空白区切り、"..." でクォート可) */
  extraArgs: string
}

/** 出力先に同名ファイルがあるときの動作 */
export type ConflictPolicy = 'overwrite' | 'skip' | 'rename'

/** キュー全体の実行・出力名に関する設定(エンコード内容そのものは EncodeSettings) */
export interface BatchSettings {
  /** 出力ファイル名のテンプレート({name}, {preset})。拡張子は含めない */
  outputTemplate: string
  onConflict: ConflictPolicy
  stopOnError: boolean
  /** 同時に実行するファイル数 */
  concurrency: number
}

/** ffmpeg の進捗(1 回分)。取れなかった項目は null */
export interface ProgressStats {
  /** ここまでに出力した映像の長さ(秒) */
  outTimeSec: number | null
  frame: number | null
  fps: number | null
  /** 再生速度の倍率(1.0 でリアルタイム) */
  speed: number | null
  bitrateKbps: number | null
  /** ここまでの出力サイズ(バイト) */
  sizeBytes: number | null
  /** 入力の総再生時間(秒)。ffprobe で取れなければ 0 */
  durationSec: number
  ended: boolean
}

export interface ProgressEvent {
  id: string
  percent: number
  stats: ProgressStats
}

export interface EncodeRequest {
  id: string
  input: string
  outDir: string | null
  outputTemplate: string
  onConflict: ConflictPolicy
  settings: EncodeSettings
}

export interface EncodeResult {
  status: 'done' | 'error' | 'canceled' | 'skipped'
  code: number | null
  /** 実際に使った出力パス(同名回避で変わることがある) */
  output?: string
  /** 完了時の入力・出力ファイルサイズ(バイト) */
  inputSize?: number
  outputSize?: number
}

export interface Preset {
  id: string
  /** 同じコーデックのプリセットをまとめる ID(CPU 版の id と同じ) */
  family: string
  label: string
  settings: Omit<EncodeSettings, 'presetId'>
}
