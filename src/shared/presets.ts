import { HW_LIST, hwKey } from './hwEncoders'
import type { EncodeSettings, HwAccel, Preset, VideoCodec } from './types'

/** 詳細設定の既定値(全プリセット共通) */
export const ADVANCED_DEFAULTS: Pick<
  EncodeSettings,
  'speed' | 'rateControl' | 'videoBitrateK' | 'pixFmt' | 'faststart' | 'audioMode' | 'audioChannels' | 'sampleRate' | 'extraArgs' | 'subtitleMode' | 'subtitleTrack' | 'subtitleFontSize' | 'stripMetadata'
> = {
  subtitleMode: 'drop',
  subtitleTrack: 0,
  subtitleFontSize: null,
  stripMetadata: false,
  speed: null,
  rateControl: 'quality',
  videoBitrateK: 5000,
  pixFmt: 'auto',
  faststart: true,
  audioMode: 'encode',
  audioChannels: null,
  sampleRate: null,
  extraArgs: ''
}

const HW_SHORT: Record<Exclude<HwAccel, 'none'>, string> = { nvenc: 'NVENC', qsv: 'QSV', amf: 'AMF' }

interface VideoFamily {
  id: string
  name: string
  codec: VideoCodec
  crf: number
  audioCodec: EncodeSettings['audioCodec']
  audioBitrateK: number
  container: EncodeSettings['container']
  /** ハードウェアエンコーダ版も用意するか(VP9 は用意しない) */
  hw: boolean
}

const VIDEO_FAMILIES: VideoFamily[] = [
  { id: 'h264', name: 'H.264', codec: 'h264', crf: 23, audioCodec: 'aac', audioBitrateK: 160, container: 'mp4', hw: true },
  { id: 'h265', name: 'HEVC', codec: 'h265', crf: 28, audioCodec: 'aac', audioBitrateK: 160, container: 'mp4', hw: true },
  { id: 'av1', name: 'AV1', codec: 'av1', crf: 32, audioCodec: 'libopus', audioBitrateK: 128, container: 'mkv', hw: true },
  { id: 'vp9', name: 'VP9', codec: 'vp9', crf: 31, audioCodec: 'libopus', audioBitrateK: 128, container: 'webm', hw: false }
]

function videoPresets(f: VideoFamily): Preset[] {
  const make = (hwAccel: HwAccel): Preset => ({
    id: hwAccel === 'none' ? f.id : `${f.id}-${hwAccel}`,
    family: f.id,
    label: `${f.name} (${hwAccel === 'none' ? 'CPU' : HW_SHORT[hwAccel]})`,
    settings: {
      hwAccel,
      videoCodec: f.codec,
      audioCodec: f.audioCodec,
      crf: f.crf,
      height: null,
      fps: null,
      audioBitrateK: f.audioBitrateK,
      container: f.container,
      ...ADVANCED_DEFAULTS
    }
  })
  return [make('none'), ...(f.hw ? HW_LIST.map(make) : [])]
}

const audioPreset = (id: string, label: string, audioCodec: EncodeSettings['audioCodec'], container: EncodeSettings['container']): Preset => ({
  id,
  family: id,
  label,
  settings: { hwAccel: 'none', videoCodec: null, audioCodec, crf: 0, height: null, fps: null, audioBitrateK: 192, container, ...ADVANCED_DEFAULTS }
})

/** CPU / NVENC / QSV / AMF の組み合わせを含む全プリセット(HW 版は検出結果に応じて画面に出す) */
export const PRESETS: Preset[] = [
  ...VIDEO_FAMILIES.flatMap(videoPresets),
  audioPreset('audio-mp3', '音声のみ (MP3)', 'libmp3lame', 'mp3'),
  audioPreset('audio-m4a', '音声のみ (M4A)', 'aac', 'm4a')
]

/** 検出結果(`h264:nvenc` の一覧)に対して、そのプリセットが使えるか */
export function presetAvailable(p: Preset, found: string[]): boolean {
  const { hwAccel, videoCodec } = p.settings
  return hwAccel === 'none' || (videoCodec !== null && found.includes(hwKey(videoCodec, hwAccel)))
}

/** 選択肢に出すプリセット。選択中のものは検出のやり直し中でも消さない */
export function selectablePresets(found: string[] | null, currentId: string): Preset[] {
  return PRESETS.filter((p) => p.id === currentId || presetAvailable(p, found ?? []))
}

/** HW 版が使えないときの代替(同じコーデックの CPU 版)の ID。CPU 版・音声のみはそのまま */
export function cpuFallbackId(id: string): string {
  return PRESETS.find((p) => p.id === id)?.family ?? id
}
