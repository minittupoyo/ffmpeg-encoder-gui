import type { ProgressStats } from '@shared/types'

/** 秒数を `m:ss`(1 時間以上は `h:mm:ss`)にする。不明なら `--:--` */
export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec < 0) return '--:--'
  const t = Math.round(sec)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** バイト数を B / KB / MB / GB(1024 区切り)にする */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${i === 0 ? v : v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`
}

/** 経過がこれ未満(%)のうちは、進みが小さすぎて所要時間を当てにできない */
const MIN_PERCENT_FOR_ETA = 3

/**
 * 1 ファイルの残り時間(秒)。ffmpeg の再生速度が取れればそれで、取れなければ経過時間と進捗率から見積もる。
 * 見積もれなければ null
 */
export function remainingSec(stats: ProgressStats | undefined, elapsedMs: number, percent: number): number | null {
  if (stats && stats.speed !== null && stats.speed > 0 && stats.durationSec > 0 && stats.outTimeSec !== null) {
    return Math.max(0, (stats.durationSec - stats.outTimeSec) / stats.speed)
  }
  return overallRemainingSec(elapsedMs, percent)
}

/** 経過時間と進捗率(0〜100)から、残り時間(秒)を比例で見積もる */
export function overallRemainingSec(elapsedMs: number, percent: number): number | null {
  if (!(percent >= MIN_PERCENT_FOR_ETA) || percent >= 100 || !(elapsedMs > 0)) return null
  return (elapsedMs / 1000) * ((100 - percent) / percent)
}

/** 出力サイズが入力の何 % か。取れなければ null */
export function sizeRatioPercent(inputSize: number | undefined, outputSize: number | undefined): number | null {
  if (!inputSize || outputSize === undefined) return null
  return (outputSize / inputSize) * 100
}
