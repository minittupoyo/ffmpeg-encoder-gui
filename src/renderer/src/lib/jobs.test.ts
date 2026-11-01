import { describe, expect, it } from 'vitest'
import { overallPercent, summarize, unfinishedFiles, type Job } from './jobs'

describe('overallPercent', () => {
  it('ファイルが無ければ 0', () => {
    expect(overallPercent([], {})).toBe(0)
  })
  it('完了分と実行中の途中経過を合算する', () => {
    const jobs: Record<string, Job> = {
      a: { status: 'done', percent: 100 },
      b: { status: 'running', percent: 50 }
    }
    expect(overallPercent(['a', 'b', 'c', 'd'], jobs)).toBe(37.5)
  })
  it('エラー・中止も処理済みとして数える', () => {
    const jobs: Record<string, Job> = {
      a: { status: 'error', percent: 10 },
      b: { status: 'canceled', percent: 0 }
    }
    expect(overallPercent(['a', 'b'], jobs)).toBe(100)
  })
})

describe('summarize / unfinishedFiles', () => {
  const jobs: Record<string, Job> = {
    a: { status: 'done', percent: 100 },
    b: { status: 'error', percent: 20 },
    c: { status: 'skipped', percent: 0 },
    d: { status: 'canceled', percent: 5 }
  }
  const files = ['a', 'b', 'c', 'd', 'e']
  it('ステータス別に集計する(未実行は数えない)', () => {
    expect(summarize(files, jobs)).toEqual({ done: 1, error: 1, canceled: 1, skipped: 1 })
  })
  it('完了・スキップ以外を未完了とする', () => {
    expect(unfinishedFiles(files, jobs)).toEqual(['b', 'd', 'e'])
  })
})
