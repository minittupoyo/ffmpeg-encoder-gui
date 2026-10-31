import { describe, expect, it } from 'vitest'
import { createProgressParser, progressPercent } from './progress'

describe('createProgressParser', () => {
  it('チャンク境界をまたぐ行も処理する', () => {
    const got: number[] = []
    const feed = createProgressParser((s) => got.push(s))
    feed('frame=1\nout_time_us=1500')
    feed('000\nprogress=continue\nout_time_us=3000000\n')
    expect(got).toEqual([1.5, 3])
  })
  it('N/A は無視する', () => {
    const got: number[] = []
    createProgressParser((s) => got.push(s))('out_time_us=N/A\n')
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
