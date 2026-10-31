import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Check, Copy, FolderOpen, Play, Plus, RotateCcw, Square, X } from 'lucide-react'
import { buildFfmpegArgs, defaultOutputPath, formatCommand } from '@shared/ffmpegArgs'
import { HW_LABEL, HW_LIST, hwKey } from '@shared/hwEncoders'
import { PRESETS } from '@shared/presets'
import type { Container, EncodeSettings, HwAccel, VideoCodec } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const CONTAINERS: Container[] = ['mp4', 'mkv', 'webm', 'mp3', 'm4a']

interface Job {
  status: 'running' | 'done' | 'error' | 'canceled'
  percent: number
}

const STATUS_LABEL: Record<Exclude<Job['status'], 'running'>, string> = {
  done: '完了',
  error: 'エラー',
  canceled: '中止'
}

/** 検出済みの HW エンコーダが当該コーデックで使えなければ 'none' に戻す */
function coerceHw(codec: VideoCodec | null, hw: HwAccel, found: string[]): HwAccel {
  return codec && hw !== 'none' && found.includes(hwKey(codec, hw)) ? hw : 'none'
}

function applyPreset(id: string, hw: HwAccel = 'none', found: string[] = []): EncodeSettings {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]
  return { presetId: p.id, hwAccel: coerceHw(p.settings.videoCodec, hw, found), ...p.settings }
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

export default function App(): React.JSX.Element {
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState(0)
  const [settings, setSettings] = useState<EncodeSettings>(() => applyPreset('h264'))
  const [outDir, setOutDir] = useState<string | null>(null)
  const [ffmpegPath, setFfmpegPath] = useState('C:\\ffmpeg\\ffmpeg.exe')
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  /** null は検出中 */
  const [hwFound, setHwFound] = useState<string[] | null>(null)
  const [ffmpegError, setFfmpegError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Record<string, Job>>({})
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const cancelRef = useRef(false)
  const activeRef = useRef<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const detect = async (): Promise<void> => {
    setHwFound(null)
    const found = await window.api.detectHw()
    setHwFound(found)
    setSettings((s) => ({ ...s, hwAccel: coerceHw(s.videoCodec, s.hwAccel, found) }))
  }

  useEffect(() => {
    void window.api.getFfmpegPath().then(setFfmpegPath)
    void detect()
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
    logEndRef.current?.scrollIntoView({ block: 'end' })
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
      void detect()
    }
  }

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const num = (v: string): number | null => (v === '' ? null : Number(v))
  const hwOptions = settings.videoCodec
    ? HW_LIST.filter((h) => hwFound?.includes(hwKey(settings.videoCodec!, h)))
    : []

  return (
    <div className="grid h-full grid-cols-2 grid-rows-[minmax(0,1fr)_auto] gap-3 p-3">
      <Card
        className={cn('min-h-0 gap-3 py-4 transition-colors', dragging && 'border-primary bg-accent')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <CardHeader className="flex flex-row items-center justify-between px-4">
          <CardTitle className="text-sm">入力キュー</CardTitle>
          <Button size="sm" variant="outline" onClick={async () => addFiles(await window.api.openFiles())}>
            <Plus /> ファイルを選択
          </Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-4">
          {files.length === 0 ? (
            <p className="text-muted-foreground m-auto text-sm">
              ここに動画 / 音声ファイルをドラッグ&amp;ドロップ
            </p>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <ul className="flex flex-col gap-1 pr-3">
                {files.map((f, i) => {
                  const job = jobs[f]
                  return (
                    <li
                      key={f}
                      title={f}
                      onClick={() => setSelected(i)}
                      className={cn(
                        'hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5',
                        i === selected && 'bg-accent'
                      )}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-sm">{f}</span>
                        {job && (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={job.percent}
                              className={cn(
                                'h-1.5',
                                job.status === 'done' && '[&>div]:bg-emerald-500',
                                (job.status === 'error' || job.status === 'canceled') && '[&>div]:bg-destructive'
                              )}
                            />
                            <span className="text-muted-foreground w-10 shrink-0 text-right text-xs">
                              {job.status === 'running' ? `${job.percent.toFixed(0)}%` : STATUS_LABEL[job.status]}
                            </span>
                          </div>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        disabled={running}
                        onClick={(e) => {
                          e.stopPropagation()
                          setFiles(files.filter((x) => x !== f))
                        }}
                      >
                        <X />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="min-h-0 gap-3 overflow-auto py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">設定</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4">
          <Field label="プリセット">
            <Select
              value={settings.presetId}
              disabled={running}
              onValueChange={(v) => setSettings((s) => applyPreset(v, s.hwAccel, hwFound ?? []))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={hwFound === null ? 'エンコーダ(ハードウェア検出中…)' : 'エンコーダ'}
            hint={settings.hwAccel !== 'none' && 'HW エンコードでは CRF を同等の品質値 (CQ/QP) として扱います'}
          >
            <div className="flex gap-2">
              <Select
                value={settings.hwAccel}
                disabled={isAudioOnly || running}
                onValueChange={(v) => patch({ hwAccel: v as HwAccel })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{HW_LABEL.none}</SelectItem>
                  {hwOptions.map((h) => (
                    <SelectItem key={h} value={h}>
                      {HW_LABEL[h]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" disabled={running || hwFound === null} onClick={() => void detect()}>
                <RotateCcw /> 再検出
              </Button>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CRF">
              <Input type="number" min={0} max={63} disabled={isAudioOnly} value={settings.crf} onChange={(e) => patch({ crf: Number(e.target.value) })} />
            </Field>
            <Field label="高さ (px)">
              <Input type="number" min={0} placeholder="元のまま" disabled={isAudioOnly} value={settings.height ?? ''} onChange={(e) => patch({ height: num(e.target.value) })} />
            </Field>
            <Field label="fps">
              <Input type="number" min={0} placeholder="元のまま" disabled={isAudioOnly} value={settings.fps ?? ''} onChange={(e) => patch({ fps: num(e.target.value) })} />
            </Field>
            <Field label="音声ビットレート (kbps)">
              <Input type="number" min={32} value={settings.audioBitrateK} onChange={(e) => patch({ audioBitrateK: Number(e.target.value) })} />
            </Field>
            <Field label="コンテナ">
              <Select value={settings.container} disabled={running} onValueChange={(v) => patch({ container: v as Container })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTAINERS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="出力先">
              <div className="flex gap-2">
                <Input readOnly value={outDir ?? '入力と同じフォルダ'} className="min-w-0" />
                <Button size="icon" variant="outline" disabled={running} onClick={async () => setOutDir((await window.api.openDir()) ?? outDir)}>
                  <FolderOpen />
                </Button>
              </div>
            </Field>
          </div>

          <Field label="ffmpeg のパス" hint={ffmpegError && <span className="text-destructive">{ffmpegError}</span>}>
            <div className="flex gap-2">
              <Input readOnly value={ffmpegPath} className="min-w-0" />
              <Button size="icon" variant="outline" disabled={running} onClick={async () => changeFfmpeg(await window.api.openExe())}>
                <FolderOpen />
              </Button>
              <Button variant="outline" disabled={running} onClick={async () => changeFfmpeg(await window.api.getDefaultFfmpegPath())}>
                既定
              </Button>
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card className="col-span-2 gap-3 py-4">
        <CardHeader className="flex flex-row items-center justify-between px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            コマンドプレビュー
            {isAudioOnly && <Badge variant="secondary">音声のみ</Badge>}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={copy} disabled={!command}>
            {copied ? <Check /> : <Copy />} {copied ? 'コピーしました' : 'コピー'}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4">
          <pre className="bg-muted max-h-28 overflow-auto rounded-md p-3 font-mono text-xs break-all whitespace-pre-wrap">
            {command || 'ファイルを追加するとここにコマンドが表示されます'}
          </pre>
          <ScrollArea className="bg-muted h-28 rounded-md">
            <pre className="text-muted-foreground p-3 font-mono text-xs break-all whitespace-pre-wrap">
              {log.join('\n') || 'ログ'}
            </pre>
            <div ref={logEndRef} />
          </ScrollArea>
          <div className="flex justify-end">
            {running ? (
              <Button variant="destructive" onClick={cancel}>
                <Square /> キャンセル
              </Button>
            ) : (
              <Button disabled={files.length === 0} onClick={start}>
                <Play /> エンコード開始
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
