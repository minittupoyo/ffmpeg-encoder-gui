import type { ProgressStats } from './types'

/** ffmpeg の `-progress` 1 ブロック分の値。取れなかった項目(`N/A` など)は null */
export type ProgressInfo = Omit<ProgressStats, 'durationSec'>

/** `N/A` や単位付きの値(`6.87x`、`942.5kbits/s`)を数値にする */
function num(v: string | undefined): number | null {
  if (v === undefined) return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/** key=value の集まりから 1 ブロック分の進捗情報を作る */
export function toProgressInfo(kv: Record<string, string>): ProgressInfo {
  // out_time_ms も実際はマイクロ秒なので out_time_us と同様に扱う
  const us = num(kv['out_time_us']) ?? num(kv['out_time_ms'])
  return {
    outTimeSec: us === null ? null : us / 1_000_000,
    frame: num(kv['frame']),
    fps: num(kv['fps']),
    speed: num(kv['speed']),
    bitrateKbps: num(kv['bitrate']),
    sizeBytes: num(kv['total_size']),
    ended: kv['progress'] === 'end'
  }
}

/**
 * `-progress pipe:1` の出力を行単位で読み、`progress=` で終わる 1 ブロックごとに通知するパーサ。
 * チャンク境界が行の途中でも扱える。
 */
export function createProgressParser(onBlock: (info: ProgressInfo) => void): (chunk: string) => void {
  let rest = ''
  let kv: Record<string, string> = {}
  return (chunk) => {
    const lines = (rest + chunk).split(/\r?\n/)
    rest = lines.pop() ?? ''
    for (const line of lines) {
      const i = line.indexOf('=')
      if (i <= 0) continue
      const key = line.slice(0, i).trim()
      kv[key] = line.slice(i + 1).trim()
      if (key === 'progress') {
        onBlock(toProgressInfo(kv))
        kv = {}
      }
    }
  }
}

export function progressPercent(outTimeSec: number, durationSec: number): number {
  if (!(durationSec > 0)) return 0
  return Math.min(100, Math.max(0, (outTimeSec / durationSec) * 100))
}
