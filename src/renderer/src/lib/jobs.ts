export interface Job {
  status: 'running' | 'done' | 'error' | 'canceled' | 'skipped'
  percent: number
  /** 完了時の出力ファイルパス(フォルダを開くために使う) */
  output?: string
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
