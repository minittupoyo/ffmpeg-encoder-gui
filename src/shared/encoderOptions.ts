import { hwEncoderName } from './hwEncoders'
import type { HwAccel, VideoCodec } from './types'

export interface SpeedSpec {
  flag: string
  options: string[]
  /** null は ffmpeg / エンコーダ側の既定値に任せる(フラグを付けない) */
  default: string | null
}

const X26X = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow']
const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i))

/** コーデック・エンコーダ種別ごとの速度/品質プリセットの指定方法 */
export function speedSpec(codec: VideoCodec, hw: HwAccel): SpeedSpec {
  if (hwEncoderName(codec, hw)) {
    if (hw === 'nvenc') return { flag: '-preset', options: range(1, 7).map((n) => `p${n}`), default: 'p5' }
    if (hw === 'qsv') return { flag: '-preset', options: X26X.slice(2), default: null }
    return { flag: '-quality', options: ['speed', 'balanced', 'quality'], default: 'quality' }
  }
  if (codec === 'av1') return { flag: '-preset', options: range(0, 13), default: null }
  if (codec === 'vp9') return { flag: '-cpu-used', options: range(0, 8), default: null }
  return { flag: '-preset', options: X26X, default: null }
}

/** 選択値が現在のエンコーダで無効なら既定値にフォールバックして引数化する */
export function speedArgs(codec: VideoCodec, hw: HwAccel, value: string | null): string[] {
  const spec = speedSpec(codec, hw)
  const v = value && spec.options.includes(value) ? value : spec.default
  return v ? [spec.flag, v] : []
}

/** 空白区切りの引数文字列を配列にする。"..." は途中にあっても空白を含められる(例: title="My Movie") */
export function splitArgs(input: string): string[] {
  const out: string[] = []
  let cur = ''
  let inToken = false
  let inQuote = false
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (inQuote && c === '\\' &&i + 1 < input.length) {
      cur += input[++i]
    } else if (c === '"') {
      inQuote = !inQuote
      inToken = true
    } else if (!inQuote && /\s/.test(c)) {
      if (inToken) out.push(cur)
      cur = ''
      inToken = false
    } else {
      cur += c
      inToken = true
    }
  }
  if (inToken) out.push(cur)
  return out
}
