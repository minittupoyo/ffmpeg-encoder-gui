import { DEFAULT_TEMPLATE } from '@shared/output'
import { PRESETS } from '@shared/presets'
import type { BatchSettings, EncodeSettings } from '@shared/types'

/** 起動をまたいで引き継ぐ画面設定(キューは含めない) */
export interface UiState {
  settings: EncodeSettings
  batch: BatchSettings
  outDir: string | null
}

export const DEFAULT_BATCH: BatchSettings = {
  outputTemplate: DEFAULT_TEMPLATE,
  onConflict: 'rename',
  stopOnError: false,
  concurrency: 1
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const oneOf = <T,>(...allowed: T[]) => (v: unknown): v is T => allowed.includes(v as T)
const posNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
const nullable = <T,>(check: (v: unknown) => v is T) => (v: unknown): v is T | null => v === null || check(v)
const str = (v: unknown): v is string => typeof v === 'string'
const bool = (v: unknown): v is boolean => typeof v === 'boolean'

/** EncodeSettings の各項目の検証。ここに無い(=将来削除された)キーは捨て、不正な値はプリセットの既定に戻す */
const SETTINGS_RULES: { [K in Exclude<keyof EncodeSettings, 'presetId'>]: (v: unknown) => boolean } = {
  hwAccel: oneOf('none', 'nvenc', 'qsv', 'amf'),
  videoCodec: oneOf('h264', 'h265', 'av1', 'vp9', null),
  audioCodec: oneOf('aac', 'libopus', 'libmp3lame'),
  crf: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 63,
  height: nullable(posNum),
  fps: nullable(posNum),
  audioBitrateK: posNum,
  container: oneOf('mp4', 'mkv', 'webm', 'mp3', 'm4a'),
  speed: nullable(str),
  rateControl: oneOf('quality', 'bitrate'),
  videoBitrateK: posNum,
  pixFmt: oneOf('auto', 'yuv420p', 'yuv420p10le'),
  faststart: bool,
  audioMode: oneOf('encode', 'copy', 'none'),
  audioChannels: oneOf(1, 2, 6, null),
  sampleRate: oneOf(44100, 48000, null),
  subtitleMode: oneOf('drop', 'copy', 'burn'),
  subtitleTrack: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0,
  subtitleFontSize: nullable(posNum),
  stripMetadata: bool,
  extraArgs: str
}

const BATCH_RULES: { [K in keyof BatchSettings]: (v: unknown) => boolean } = {
  outputTemplate: str,
  onConflict: oneOf('overwrite', 'skip', 'rename'),
  stopOnError: bool,
  concurrency: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 4
}

/** 保存された値を検証し、使える項目だけ拾って既定値と合成する。壊れた入力でも例外は出さない */
export function restoreUiState(raw: unknown, fallback: UiState): UiState {
  if (!isObj(raw)) return fallback

  let settings = fallback.settings
  if (isObj(raw.settings)) {
    const saved = raw.settings
    const p = PRESETS.find((x) => x.id === saved.presetId)
    if (p) {
      const next: Record<string, unknown> = { presetId: p.id, ...p.settings }
      for (const [key, ok] of Object.entries(SETTINGS_RULES)) {
        if (key in saved && ok(saved[key])) next[key] = saved[key]
      }
      settings = next as unknown as EncodeSettings
    }
  }

  const batch: Record<string, unknown> = { ...fallback.batch }
  if (isObj(raw.batch)) {
    for (const [key, ok] of Object.entries(BATCH_RULES)) {
      if (key in raw.batch && ok(raw.batch[key])) batch[key] = raw.batch[key]
    }
  }

  const outDir = typeof raw.outDir === 'string' && raw.outDir !== '' ? raw.outDir : null
  return { settings, batch: batch as unknown as BatchSettings, outDir }
}
