import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { splitPath } from '@shared/path'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface ConsolePanelProps {
  /** 選択中ファイルのコマンド(未選択なら空) */
  command: string
  commandFile: string | undefined
  log: string[]
  /** true になった瞬間にログタブへ切り替える */
  running: boolean
}

/** 画面下部のコマンドプレビューとログ。同じ領域をタブで切り替える */
export function ConsolePanel({ command, commandFile, log, running }: ConsolePanelProps): React.JSX.Element {
  const [tab, setTab] = useState('command')
  const [copied, setCopied] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (running) setTab('log')
  }, [running])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [log, tab])

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="bg-card h-52 gap-0 rounded-xl border">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <TabsList>
          <TabsTrigger value="command">コマンド</TabsTrigger>
          <TabsTrigger value="log">ログ{log.length > 0 && ` (${log.length})`}</TabsTrigger>
        </TabsList>
        {tab === 'command' ? (
          <div className="flex min-w-0 items-center gap-2">
            {commandFile && (
              <span className="text-muted-foreground truncate text-xs" title={commandFile}>
                対象: {splitPath(commandFile).name}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={copy} disabled={!command}>
              {copied ? <Check /> : <Copy />} {copied ? 'コピーしました' : 'コピー'}
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">ffmpeg の出力</span>
        )}
      </div>
      <TabsContent value="command" className="min-h-0 flex-1 overflow-auto p-3">
        <pre className="font-mono text-xs break-all whitespace-pre-wrap">
          {command || 'ファイルを追加するとここに実行されるコマンドが表示されます'}
        </pre>
      </TabsContent>
      <TabsContent value="log" className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <pre className="text-muted-foreground p-3 font-mono text-xs break-all whitespace-pre-wrap">
            {log.join('\n') || 'エンコードを開始するとここに ffmpeg の出力が表示されます'}
          </pre>
          <div ref={endRef} />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}
