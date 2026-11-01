import { AlertCircle, Check, FolderPlus, FolderSearch, Plus, Trash2, Upload, X } from 'lucide-react'
import { fileNameTailLen, splitPath, splitTail } from '@shared/path'
import { MiddleEllipsis } from '@/components/MiddleEllipsis'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Job } from '@/lib/jobs'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<Exclude<Job['status'], 'running'>, string> = {
  done: '完了',
  error: 'エラー',
  canceled: '中止',
  skipped: 'スキップ'
}

/** キュー内の 1 行: ファイル名を主に(拡張子は常に表示)、フォルダは淡く小さく表示する */
function QueueName({ path }: { path: string }): React.JSX.Element {
  const { dir, name } = splitPath(path)
  const [nameHead, nameTail] = splitTail(name, fileNameTailLen(name))
  const [dirHead, dirTail] = splitTail(dir, 16)
  return (
    <div className="flex min-w-0 flex-col">
      <MiddleEllipsis head={nameHead} tail={nameTail} className="text-sm" />
      {dir && <MiddleEllipsis head={dirHead} tail={dirTail} className="text-muted-foreground text-xs" />}
    </div>
  )
}

export interface QueuePanelProps {
  files: string[]
  selected: number
  setSelected: (i: number) => void
  jobs: Record<string, Job>
  running: boolean
  onAdd: () => void
  onAddFolder: () => void
  onRemove: (file: string) => void
  onClear: () => void
  onReveal: (path: string) => void
}

export function QueuePanel({
  files,
  selected,
  setSelected,
  jobs,
  running,
  onAdd,
  onAddFolder,
  onRemove,
  onClear,
  onReveal
}: QueuePanelProps): React.JSX.Element {
  const doneCount = files.filter((f) => jobs[f]?.status === 'done').length

  return (
    <Card className="min-h-0 gap-3 py-4">
      <CardHeader className="flex flex-row items-center justify-between px-4">
        <CardTitle className="text-sm">
          入力キュー
          {files.length > 0 && (
            <span className="text-muted-foreground ml-2 font-normal">
              {Object.keys(jobs).length > 0 ? `${doneCount} / ${files.length} 完了` : `${files.length} 件`}
            </span>
          )}
        </CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={running} onClick={onAdd} title="ファイルを追加 (Ctrl+O)">
            <Plus /> 追加
          </Button>
          <Button size="sm" variant="outline" disabled={running} onClick={onAddFolder} title="フォルダ内のメディアファイルをまとめて追加">
            <FolderPlus /> フォルダ
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={running || files.length === 0}
            onClick={onClear}
            title="キューをすべて削除"
          >
            <Trash2 />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-4">
        {files.length === 0 ? (
          <button
            type="button"
            onClick={onAdd}
            className="text-muted-foreground hover:border-primary hover:text-foreground m-auto flex w-full flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm transition-colors"
          >
            <Upload className="size-8" />
            <span>動画 / 音声ファイルをここにドロップ</span>
            <span className="text-xs">またはクリックして選択 (Ctrl+O)</span>
          </button>
        ) : (
          // Radix の viewport 直下は display:table で幅が内容に広がるため、block にして省略表示を効かせる
          <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
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
                      <QueueName path={f} />
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
                          <span className="text-muted-foreground flex w-14 shrink-0 items-center justify-end gap-1 text-xs">
                            {job.status === 'done' && <Check className="size-3 text-emerald-500" />}
                            {job.status === 'error' && <AlertCircle className="text-destructive size-3" />}
                            {job.status === 'running' ? `${job.percent.toFixed(0)}%` : STATUS_LABEL[job.status]}
                          </span>
                        </div>
                      )}
                    </div>
                    {(job?.status === 'done' || job?.status === 'skipped') && job.output && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        title="出力ファイルの場所を開く"
                        onClick={(e) => {
                          e.stopPropagation()
                          onReveal(job.output!)
                        }}
                      >
                        <FolderSearch />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      disabled={running}
                      title="キューから削除 (Delete)"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemove(f)
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
  )
}
