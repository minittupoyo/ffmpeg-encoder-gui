import { describe, expect, it } from 'vitest'
import { createProgressParser, progressPercent, toProgressInfo, type ProgressInfo } from './progress'

const BLOCK = [
  'frame=34807',
  'fps=165.0',
  'total_size=167033856',
  'out_time_us=1451740000',
  'bitrate= 942.5kbits/s',
  'speed=6.87x',
  'progress=continue'
].join('\n')

describe('toProgressInfo', () => {
  it('各項目を数値にする(単位つきの値も)', () => {
    expect(toProgressInfo(Object.fromEntries(BLOCK.split('\n').map((l) => l.split('=')))))
      .toEqual({ outTimeSec: 1451.74, frame: 34807, fps: 165, speed: 6.87, bitrateKbps: 942.5, sizeBytes: 167033856, ended: false })
  })
  it('N/A や欠けた項目は null', () => {
    const r = toProgressInfo({ out_time_us: 'N/A', bitrate: 'N/A', speed: 'N/A', progress: 'end' })
    expect(r).toMatchObject({ outTimeSec: null, bitrateKbps: null, speed: null, frame: null, ended: true })
  })
  it('out_time_us が無ければ out_time_ms を使う', () => {
    expect(toProgressInfo({ out_time_ms: '2500000' }).outTimeSec).toBe(2.5)
  })
})

describe('createProgressParser', () => {
  it('progress= で 1 ブロックとして通知する', () => {
    const got: ProgressInfo[] = []
    createProgressParser((p) => got.push(p))(`${BLOCK}\nframe=1\nprogress=end\n`)
    expect(got).toHaveLength(2)
    expect(got[0].speed).toBe(6.87)
    expect(got[1]).toMatchObject({ frame: 1, ended: true })
  })
  it('チャンク境界をまたぐ行も処理する', () => {
    const got: ProgressInfo[] = []
    const feed = createProgressParser((p) => got.push(p))
    feed('frame=1\nout_time_us=1500')
    feed('000\nprogress=continue\nout_time_us=3000000\nprogress=continue\n')
    expect(got.map((p) => p.outTimeSec)).toEqual([1.5, 3])
  })
  it('ブロックをまたいで値を持ち越さない', () => {
    const got: ProgressInfo[] = []
    createProgressParser((p) => got.push(p))('fps=30\nprogress=continue\nprogress=continue\n')
    expect(got[1].fps).toBeNull()
  })
  it('progress= が来るまでは通知しない', () => {
    const got: ProgressInfo[] = []
    createProgressParser((p) => got.push(p))('out_time_us=1000000\n')
    expect(got).toEqual([])
  })
})

describe('progressPercent', () => {
  it('0〜100 に丸める', () => {
    expect(progressPercent(5, 10)).toBe(50)
    expect(progressPercent(20, 10)).toBe(100)
    expect(progressPercent(5, 0)).toBe(0)
  })
})
