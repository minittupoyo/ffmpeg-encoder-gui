import type { ProgressStats } from '@shared/types'

export interface Job {
  status: 'running' | 'done' | 'error' | 'canceled' | 'skipped'
  percent: number
  /** 完了時の出力ファイルパス(フォルダを開くために使う) */
  output?: string
  /** 実行中の最新の詳細(速度・fps・ビットレートなど) */
  stats?: ProgressStats
  /** 開始時刻(ms)。経過時間の計算に使う */
  startedAt?: number
  /** 終了までにかかった時間(ms) */
  elapsedMs?: number
  inputSize?: number
  outputSize?: number
}

/**
 * 進捗イベントをジョブに反映する。進捗イベントと完了通知は別経路で届くため順序が前後することがあり、
 * 完了・失敗などが確定したジョブや未登録のジョブは上書きしない(遅れて届いた 100% で「完了」が戻るのを防ぐ)
 */
export function applyProgress(
  jobs: Record<string, Job>,
  id: string,
  percent: number,
  stats?: ProgressStats
): Record<string, Job> {
  const cur = jobs[id]
  if (!cur || cur.status !== 'running') return jobs
  return { ...jobs, [id]: { ...cur, percent, stats: stats ?? cur.stats } }
}

/** 完了したファイルの入力・出力サイズの合計 */
export function sumSizes(files: string[], jobs: Record<string, Job>): { input: number; output: number } {
  let input = 0
  let output = 0
  for (const f of files) {
    const j = jobs[f]
    if (j?.status === 'done' && j.inputSize !== undefined && j.outputSize !== undefined) {
      input += j.inputSize
      output += j.outputSize
    }
  }
  return { input, output }
}

/** 実行結果の集計(処理済みの件数をステータス別に数える) */
export function summarize(files: string[], jobs: Record<string, Job>): Record<Exclude<Job['status'], 'running'>, number> {
  const r = { done: 0, error: 0, canceled: 0, skipped: 0 }
  for (const f of files) {
    const s = jobs[f]?.status
    if (s && s !== 'running') r[s]++
  }
  return r
}

/** 「未完了のみ再実行」の対象: まだ実行していない、または失敗・中止したファイル */
export function unfinishedFiles(files: string[], jobs: Record<string, Job>): string[] {
  return files.filter((f) => {
    const s = jobs[f]?.status
    return s !== 'done' && s !== 'skipped'
  })
}

/** 全体の進捗(0〜100)。完了/失敗/中止済みを 1 件分、実行中は途中経過分として数える */
export function overallPercent(files: string[], jobs: Record<string, Job>): number {
  if (files.length === 0) return 0
  const sum = files.reduce((acc, f) => {
    const j = jobs[f]
    if (!j) return acc
    return acc + (j.status === 'running' ? j.percent / 100 : 1)
  }, 0)
  return (sum / files.length) * 100
}
