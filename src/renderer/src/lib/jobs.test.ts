import { describe, expect, it } from 'vitest'
import { applyProgress, overallPercent, summarize, sumSizes, unfinishedFiles, type Job } from './jobs'

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

describe('applyProgress', () => {
  it('実行中のジョブの進捗を更新する', () => {
    const jobs: Record<string, Job> = { a: { status: 'running', percent: 10 } }
    expect(applyProgress(jobs, 'a', 55).a).toEqual({ status: 'running', percent: 55 })
  })
  it('完了後に遅れて届いた進捗で状態を戻さない', () => {
    const jobs: Record<string, Job> = { a: { status: 'done', percent: 100, output: 'x.mkv' } }
    expect(applyProgress(jobs, 'a', 100)).toBe(jobs)
    expect(applyProgress(jobs, 'a', 99).a.status).toBe('done')
  })
  it('失敗・中止・スキップも上書きしない', () => {
    for (const status of ['error', 'canceled', 'skipped'] as const) {
      const jobs: Record<string, Job> = { a: { status, percent: 30 } }
      expect(applyProgress(jobs, 'a', 100)).toBe(jobs)
    }
  })
  it('未登録(削除済み)のジョブは作らない', () => {
    const jobs: Record<string, Job> = {}
    expect(applyProgress(jobs, 'gone', 50)).toBe(jobs)
  })
})

describe('applyProgress の詳細情報', () => {
  const st = { outTimeSec: 10, frame: 300, fps: 30, speed: 2, bitrateKbps: 900, sizeBytes: 1000, durationSec: 100, ended: false }
  it('実行中のジョブに stats を保持する', () => {
    const jobs: Record<string, Job> = { a: { status: 'running', percent: 0 } }
    expect(applyProgress(jobs, 'a', 10, st).a.stats).toEqual(st)
  })
  it('stats が無い更新では直前の stats を残す', () => {
    const jobs: Record<string, Job> = { a: { status: 'running', percent: 5, stats: st } }
    expect(applyProgress(jobs, 'a', 6).a.stats).toEqual(st)
  })
})

describe('sumSizes', () => {
  it('完了したファイルだけ合計する', () => {
    const jobs: Record<string, Job> = {
      a: { status: 'done', percent: 100, inputSize: 1000, outputSize: 400 },
      b: { status: 'done', percent: 100, inputSize: 2000, outputSize: 500 },
      c: { status: 'error', percent: 10, inputSize: 9999, outputSize: 9999 },
      d: { status: 'done', percent: 100 }
    }
    expect(sumSizes(['a', 'b', 'c', 'd', 'e'], jobs)).toEqual({ input: 3000, output: 900 })
  })
})
