/** `-progress pipe:1` の出力(key=value 行)から out_time を拾い、行単位で通知するパーサ */
export function createProgressParser(onOutTimeSec: (sec: number) => void): (chunk: string) => void {
  let rest = ''
  return (chunk) => {
    const lines = (rest + chunk).split(/\r?\n/)
    rest = lines.pop() ?? ''
    for (const line of lines) {
      // out_time_ms も実際はマイクロ秒なので out_time_us と同様に扱う
      const m = /^out_time_(?:us|ms)=(-?\d+)$/.exec(line.trim())
      if (m) onOutTimeSec(Number(m[1]) / 1_000_000)
    }
  }
}

export function progressPercent(outTimeSec: number, durationSec: number): number {
  if (!(durationSec > 0)) return 0
  return Math.min(100, Math.max(0, (outTimeSec / durationSec) * 100))
}
