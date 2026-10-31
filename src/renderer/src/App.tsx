import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { buildFfmpegArgs, defaultOutputPath, formatCommand } from '@shared/ffmpegArgs'
import { PRESETS } from '@shared/presets'
import type { Container, EncodeSettings } from '@shared/types'

const CONTAINERS: Container[] = ['mp4', 'mkv', 'webm', 'mp3', 'm4a']

interface Job {
  status: 'running' | 'done' | 'error' | 'canceled'
  percent: number
}

const STATUS_LABEL: Record<Job['status'], string> = {
  running: '',
  done: '完了',
  error: 'エラー',
  canceled: '中止'
}

function applyPreset(id: string): EncodeSettings {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]
  return { presetId: p.id, ...p.settings }
}

export default function App(): React.JSX.Element {
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState(0)
  const [settings, setSettings] = useState<EncodeSettings>(() => applyPreset('h264'))
  const [outDir, setOutDir] = useState<string | null>(null)
  const [ffmpegPath, setFfmpegPath] = useState('C:\\ffmpeg\\ffmpeg.exe')
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [ffmpegError, setFfmpegError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Record<string, Job>>({})
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const cancelRef = useRef(false)
  const activeRef = useRef<string | null>(null)
  const logRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    void window.api.getFfmpegPath().then(setFfmpegPath)
  }, [])

  const addFiles = (paths: string[]): void =>
    setFiles((prev) => [...prev, ...paths.filter((p) => !prev.includes(p))])

  const onDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files).map((f) => window.api.getPathForFile(f)))
  }

  const patch = (p: Partial<EncodeSettings>): void => setSettings((s) => ({ ...s, ...p }))
  const isAudioOnly = settings.videoCodec === null
  const current = files[Math.min(selected, files.length - 1)]

  const command = useMemo(() => {
    if (!current) return ''
    const out = defaultOutputPath(current, settings.container, outDir ?? undefined)
    return formatCommand(ffmpegPath, buildFfmpegArgs(current, out, settings))
  }, [current, settings, outDir, ffmpegPath])

  useEffect(() => {
    const offP = window.api.onProgress(({ id, percent }) =>
      setJobs((j) => ({ ...j, [id]: { ...j[id], status: 'running', percent } }))
    )
    const offL = window.api.onLog(({ line }) => setLog((l) => [...l.slice(-499), line]))
    return () => {
      offP()
      offL()
    }
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  const start = async (): Promise<void> => {
    cancelRef.current = false
    setRunning(true)
    setLog([])
    setJobs({})
    for (const input of files) {
      if (cancelRef.current) break
      activeRef.current = input
      setJobs((j) => ({ ...j, [input]: { status: 'running', percent: 0 } }))
      const r = await window.api.runEncode({ id: input, input, outDir, settings })
      setJobs((j) => ({
        ...j,
        [input]: { status: r.status, percent: r.status === 'done' ? 100 : (j[input]?.percent ?? 0) }
      }))
    }
    activeRef.current = null
    setRunning(false)
  }

  const cancel = (): void => {
    cancelRef.current = true
    if (activeRef.current) window.api.cancelEncode(activeRef.current)
  }

  const changeFfmpeg = async (path: string | null): Promise<void> => {
    if (!path) return
    const err = await window.api.setFfmpegPath(path)
    if (err) {
      setFfmpegError(err)
    } else {
      setFfmpegError(null)
      setFfmpegPath(path)
    }
  }

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const num = (v: string): number | null => (v === '' ? null : Number(v))

  return (
    <div className="app">
      <section
        className={`panel queue ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <header>
          <h2>入力キュー</h2>
          <button onClick={async () => addFiles(await window.api.openFiles())}>ファイルを選択…</button>
        </header>
        {files.length === 0 ? (
          <p className="empty">ここに動画 / 音声ファイルをドラッグ&amp;ドロップ</p>
        ) : (
          <ul>
            {files.map((f, i) => (
              <li key={f} className={i === selected ? 'sel' : ''} onClick={() => setSelected(i)} title={f}>
                <div className="item">
                  <span>{f}</span>
                  {jobs[f] && (
                    <div className="bar" data-status={jobs[f].status}>
                      <div style={{ width: `${jobs[f].percent}%` }} />
                      <em>
                        {STATUS_LABEL[jobs[f].status] || `${jobs[f].percent.toFixed(0)}%`}
                      </em>
                    </div>
                  )}
                </div>
                <button
                  className="x"
                  disabled={running}
                  onClick={(e) => {
                    e.stopPropagation()
                    setFiles(files.filter((x) => x !== f))
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel settings">
        <h2>設定</h2>
        <label>
          プリセット
          <select value={settings.presetId} onChange={(e) => setSettings(applyPreset(e.target.value))}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid">
          <label>
            CRF
            <input type="number" min={0} max={63} disabled={isAudioOnly} value={settings.crf} onChange={(e) => patch({ crf: Number(e.target.value) })} />
          </label>
          <label>
            高さ (px)
            <input type="number" min={0} placeholder="元のまま" disabled={isAudioOnly} value={settings.height ?? ''} onChange={(e) => patch({ height: num(e.target.value) })} />
          </label>
          <label>
            fps
            <input type="number" min={0} placeholder="元のまま" disabled={isAudioOnly} value={settings.fps ?? ''} onChange={(e) => patch({ fps: num(e.target.value) })} />
          </label>
          <label>
            音声ビットレート (kbps)
            <input type="number" min={32} value={settings.audioBitrateK} onChange={(e) => patch({ audioBitrateK: Number(e.target.value) })} />
          </label>
          <label>
            コンテナ
            <select value={settings.container} onChange={(e) => patch({ container: e.target.value as Container })}>
              {CONTAINERS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            出力先
            <div className="row">
              <input readOnly value={outDir ?? '入力と同じフォルダ'} />
              <button onClick={async () => setOutDir((await window.api.openDir()) ?? outDir)}>…</button>
            </div>
          </label>
        </div>
        <label>
          ffmpeg のパス
          <div className="row">
            <input readOnly value={ffmpegPath} />
            <button disabled={running} onClick={async () => changeFfmpeg(await window.api.openExe())}>
              …
            </button>
            <button
              disabled={running}
              onClick={async () => changeFfmpeg(await window.api.getDefaultFfmpegPath())}
            >
              既定
            </button>
          </div>
          {ffmpegError && <span className="err">{ffmpegError}</span>}
        </label>
      </section>

      <section className="panel preview">
        <header>
          <h2>コマンドプレビュー</h2>
          <button onClick={copy} disabled={!command}>
            {copied ? 'コピーしました' : 'コピー'}
          </button>
        </header>
        <pre>{command || 'ファイルを追加するとここにコマンドが表示されます'}</pre>
        <pre className="log" ref={logRef}>
          {log.join('\n') || 'ログ'}
        </pre>
        <footer>
          {running ? (
            <button onClick={cancel}>キャンセル</button>
          ) : (
            <button className="primary" disabled={files.length === 0} onClick={start}>
              エンコード開始
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
