import { describe, expect, it } from 'vitest'
import type { ProgressStats } from '@shared/types'
import { formatBytes, formatDuration, overallRemainingSec, remainingSec, sizeRatioPercent } from './format'

const stats = (p: Partial<ProgressStats>): ProgressStats => ({
  outTimeSec: null, frame: null, fps: null, speed: null, bitrateKbps: null, sizeBytes: null, durationSec: 0, ended: false, ...p
})

describe('formatDuration', () => {
  it('m:ss と h:mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3599.6)).toBe('1:00:00')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
  it('不明・不正は --:--', () => {
    for (const v of [null, undefined, NaN, -1, Infinity]) expect(formatDuration(v)).toBe('--:--')
  })
})

describe('formatBytes', () => {
  it('単位を切り替える', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(167033856)).toBe('159 MB')
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB')
  })
  it('不明は —', () => {
    expect(formatBytes(undefined)).toBe('—')
    expect(formatBytes(null)).toBe('—')
  })
})

describe('remainingSec', () => {
  it('再生速度から求める', () => {
    expect(remainingSec(stats({ speed: 4, outTimeSec: 100, durationSec: 500 }), 10_000, 20)).toBe(100)
  })
  it('速度が無ければ経過時間と進捗率から比例で見積もる', () => {
    expect(remainingSec(stats({ durationSec: 500 }), 30_000, 25)).toBe(90)
  })
  it('進捗が小さすぎる間は見積もらない', () => {
    expect(remainingSec(undefined, 5_000, 1)).toBeNull()
  })
  it('終了時間を超えても負にならない', () => {
    expect(remainingSec(stats({ speed: 2, outTimeSec: 510, durationSec: 500 }), 1000, 100)).toBe(0)
  })
})

describe('overallRemainingSec / sizeRatioPercent', () => {
  it('比例見積もり', () => {
    expect(overallRemainingSec(60_000, 50)).toBe(60)
    expect(overallRemainingSec(60_000, 100)).toBeNull()
    expect(overallRemainingSec(0, 50)).toBeNull()
  })
  it('サイズ比', () => {
    expect(sizeRatioPercent(1000, 370)).toBe(37)
    expect(sizeRatioPercent(0, 10)).toBeNull()
    expect(sizeRatioPercent(1000, undefined)).toBeNull()
  })
})
