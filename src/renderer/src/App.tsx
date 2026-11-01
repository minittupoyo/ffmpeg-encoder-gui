import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Play, RotateCw, Square, Upload } from 'lucide-react'
import { buildFfmpegArgs, formatCommand } from '@shared/ffmpegArgs'
import { resolveOutputPath } from '@shared/output'
import { splitPath } from '@shared/path'
import type { BatchSettings, EncodeSettings } from '@shared/types'
import { ConsolePanel } from '@/components/ConsolePanel'
import { QueuePanel } from '@/components/QueuePanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { applyProgress, overallPercent, summarize, unfinishedFiles, type Job } from '@/lib/jobs'
import { DEFAULT_BATCH, restoreUiState } from '@/lib/persist'
import { applyPreset, reconcileHw } from '@/lib/settings'

export default function App(): React.JSX.Element {
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState(0)
  const [settings, setSettings] = useState<EncodeSettings>(() => applyPreset('h264'))
  const [outDir, setOutDir] = useState<string | null>(null)
  const [batch, setBatch] = useState<BatchSettings>(DEFAULT_BATCH)
  /** 前回設定の読み込みが終わるまで保存しない(既定値で上書きしないため) */
  const [restored, setRestored] = useState(false)
  const [ffmpegPath, setFfmpegPath] = useState('C:\\ffmpeg\\ffmpeg.exe')
  const [dragging, setDragging] = useState(false)
  /** null は検出中 */
  const [hwFound, setHwFound] = useState<string[] | null>(null)
  const [ffmpegError, setFfmpegError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Record<string, Job>>({})
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const cancelRef = useRef(false)
  /** 実行中のファイル(同時実行があるので複数) */
  const activeRef = useRef(new Set<string>())
  /** ログの行頭にファイル名を付けるかどうか(同時実行中のみ) */
  const prefixLogRef = useRef(false)

  const detect = async (): Promise<void> => {
    setHwFound(null)
    const found = await window.api.detectHw()
    setHwFound(found)
    setSettings((s) => reconcileHw(s, found))
  }

  useEffect(() => {
    void window.api.getFfmpegPath().then(setFfmpegPath)
    // 前回設定を戻してからハードウェア検出する(検出結果で使えない HW 版は CPU 版に戻る)
    window.api
      .loadUiState()
      .then((raw) => {
        const r = restoreUiState(raw, { settings: applyPreset('h264'), batch: DEFAULT_BATCH, outDir: null })
        setSettings(r.settings)
        setBatch(r.batch)
        setOutDir(r.outDir)
      })
      .catch(() => {})
      .finally(() => {
        setRestored(true)
        void detect()
      })
  }, [])

  // 設定が変わったら少し待ってから保存する
  useEffect(() => {
    if (!restored) return
    const t = setTimeout(() => void window.api.saveUiState({ settings, batch, outDir }), 300)
    return () => clearTimeout(t)
  }, [restored, settings, batch, outDir])

  const resetSettings = (): void => {
    setSettings(applyPreset('h264'))
    setBatch(DEFAULT_BATCH)
    setOutDir(null)
  }

  useEffect(() => {
    const offP = window.api.onProgress(({ id, percent }) => setJobs((j) => applyProgress(j, id, percent)))
    const offL = window.api.onLog(({ id, line }) =>
      setLog((l) => [...l.slice(-499), prefixLogRef.current ? `[${splitPath(id).name}] ${line}` : line])
    )
    return () => {
      offP()
      offL()
    }
  }, [])

  const addFiles = (paths: string[]): void =>
    setFiles((prev) => [...prev, ...paths.filter((p) => !prev.includes(p))])

  const openFiles = async (): Promise<void> => addFiles(await window.api.openFiles())
  const openFolder = async (): Promise<void> => addFiles(await window.api.addFolder())

  const removeFile = (file: string): void => {
    setFiles((prev) => prev.filter((x) => x !== file))
    setJobs(({ [file]: _removed, ...rest }) => rest)
  }

  const clearFiles = (): void => {
    setFiles([])
    setJobs({})
    setSelected(0)
  }

  const current = files[Math.min(selected, files.length - 1)]

  // キーボード: Ctrl+O で追加、Delete で選択中を削除(入力欄の編集中は除く)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (e.ctrlKey && e.key.toLowerCase() === 'o' && !running) {
        e.preventDefault()
        void openFiles()
      } else if (e.key === 'Delete' && !typing && !running && current) {
        removeFile(current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, current])

  // ウィンドウのどこにドロップしても追加できるようにする
  const onDragOver = (e: DragEvent): void => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      setDragging(true)
    }
  }
  const onDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDragging(false)
    if (running) return
    const paths = Array.from(e.dataTransfer.files).map((f) => window.api.getPathForFile(f))
    // フォルダがドロップされた場合は配下のメディアファイルに展開する
    void window.api.expandPaths(paths).then(addFiles)
  }

  const command = useMemo(() => {
    if (!current) return ''
    const out = resolveOutputPath(current, settings.container, outDir, batch.outputTemplate, settings.presetId)
    return formatCommand(ffmpegPath, buildFfmpegArgs(current, out, settings))
  }, [current, settings, outDir, batch.outputTemplate, ffmpegPath])

  /** targets を batch.concurrency 個ずつ並行して処理する */
  const runBatch = async (targets: string[]): Promise<void> => {
    cancelRef.current = false
    setRunning(true)
    setLog([])
    prefixLogRef.current = batch.concurrency > 1
    setJobs((j) => {
      const next = { ...j }
      for (const t of targets) delete next[t]
      return next
    })

    const queue = [...targets]
    let stop = false
    const worker = async (): Promise<void> => {
      while (!stop && !cancelRef.current) {
        const input = queue.shift()
        if (!input) return
        activeRef.current.add(input)
        setJobs((j) => ({ ...j, [input]: { status: 'running', percent: 0 } }))
        const r = await window.api.runEncode({
          id: input,
          input,
          outDir,
          outputTemplate: batch.outputTemplate,
          onConflict: batch.onConflict,
          settings
        })
        activeRef.current.delete(input)
        setJobs((j) => ({
          ...j,
          [input]: {
            status: r.status,
            percent: r.status === 'done' ? 100 : (j[input]?.percent ?? 0),
            output: r.status === 'done' || r.status === 'skipped' ? r.output : undefined
          }
        }))
        if (r.status === 'error' && batch.stopOnError) stop = true
      }
    }
    await Promise.all(Array.from({ length: Math.min(batch.concurrency, targets.length) }, worker))
    setRunning(false)
  }

  const start = (): Promise<void> => runBatch(files)
  const retryUnfinished = (): Promise<void> => runBatch(unfinishedFiles(files, jobs))

  const cancel = (): void => {
    cancelRef.current = true
    for (const id of activeRef.current) window.api.cancelEncode(id)
  }

  const changeFfmpeg = async (path: string | null): Promise<void> => {
    if (!path) return
    const err = await window.api.setFfmpegPath(path)
    if (err) {
      setFfmpegError(err)
    } else {
      setFfmpegError(null)
      setFfmpegPath(path)
      void detect()
    }
  }

  const hwSummary = hwFound === null ? '検出中…' : hwFound.length > 0 ? `HW エンコード: 利用可` : 'HW エンコード: 未検出'
  const total = overallPercent(files, jobs)
  const counts = summarize(files, jobs)
  const finished = counts.done + counts.error + counts.canceled + counts.skipped
  const hasJobs = Object.keys(jobs).length > 0
  const pending = unfinishedFiles(files, jobs).length
  const summaryText = [
    `完了 ${counts.done}`,
    counts.error > 0 && `エラー ${counts.error}`,
    counts.skipped > 0 && `スキップ ${counts.skipped}`,
    counts.canceled > 0 && `中止 ${counts.canceled}`
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="relative flex h-full flex-col" onDragOver={onDragOver} onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)} onDrop={onDrop}>
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <h1 className="text-sm font-semibold">ffmpeg Encoder</h1>
        <Badge variant="secondary" title="設定の「映像」タブで再検出できます">
          {hwSummary}
        </Badge>
        <div className="ml-auto flex items-center gap-3">
          {hasJobs && (
            <div className="flex items-center gap-2">
              <span
                className={cn('text-xs whitespace-nowrap', !running && counts.error > 0 ? 'text-destructive' : 'text-muted-foreground')}
                title={`${finished} / ${files.length} 件処理済み`}
              >
                {running ? `${finished} / ${files.length} 件処理済み` : summaryText}
              </span>
              {running && (
                <>
                  <Progress value={total} className="h-2 w-40" />
                  <span className="w-9 text-right text-xs tabular-nums">{total.toFixed(0)}%</span>
                </>
              )}
            </div>
          )}
          {running ? (
            <Button variant="destructive" onClick={cancel}>
              <Square /> キャンセル
            </Button>
          ) : (
            <>
              {hasJobs && pending > 0 && pending < files.length && (
                <Button variant="outline" onClick={retryUnfinished} title="完了・スキップ済みを除いて再実行します">
                  <RotateCw /> 未完了のみ再実行 ({pending})
                </Button>
              )}
              <Button
              disabled={files.length === 0 || (hwFound === null && settings.hwAccel !== 'none')}
              title={hwFound === null && settings.hwAccel !== 'none' ? 'ハードウェアの検出が終わるまでお待ちください' : undefined}
              onClick={start}
            >
                <Play /> {hasJobs ? 'すべて再実行' : 'エンコード開始'}
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(300px,2fr)_3fr] gap-3 p-3 pb-0">
        <QueuePanel
          files={files}
          selected={selected}
          setSelected={setSelected}
          jobs={jobs}
          running={running}
          onAdd={() => void openFiles()}
          onAddFolder={() => void openFolder()}
          onRemove={removeFile}
          onClear={clearFiles}
          onReveal={(p) => window.api.revealInFolder(p)}
        />
        <SettingsPanel
          onReset={resetSettings}
          batch={batch}
          setBatch={setBatch}
          settings={settings}
          setSettings={setSettings}
          hwFound={hwFound}
          detect={detect}
          running={running}
          outDir={outDir}
          setOutDir={setOutDir}
          ffmpegPath={ffmpegPath}
          ffmpegError={ffmpegError}
          changeFfmpeg={changeFfmpeg}
        />
      </main>

      <div className="p-3">
        <ConsolePanel command={command} commandFile={current} log={log} running={running} />
      </div>

      {dragging && (
        <div className="bg-background/80 border-primary pointer-events-none absolute inset-2 z-50 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed">
          <Upload className="size-10" />
          <p className="text-sm">ドロップしてキューに追加</p>
        </div>
      )}
    </div>
  )
}
