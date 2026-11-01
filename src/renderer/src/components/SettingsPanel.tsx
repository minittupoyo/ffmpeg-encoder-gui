import { FolderOpen, RotateCcw } from 'lucide-react'
import { speedSpec } from '@shared/encoderOptions'
import { HW_LABEL, hwEncoderName } from '@shared/hwEncoders'
import { selectablePresets } from '@shared/presets'
import { DEFAULT_TEMPLATE, expandTemplate } from '@shared/output'
import type { AudioMode, BatchSettings, ConflictPolicy, Container, EncodeSettings, HwAccel, PixFmt, RateControl, SubtitleMode } from '@shared/types'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { applyPreset } from '@/lib/settings'

const DEFAULT_SPEED = '__default'
/** 字幕を格納できるコンテナと、その字幕形式の表示名(ffmpegArgs の SUBTITLE_CODEC と対応) */
const SUBTITLE_NOTE: Record<string, string> = { mp4: 'mov_text', mkv: '元の形式のまま', webm: 'WebVTT' }
const CONTAINERS: Container[] = ['mp4', 'mkv', 'webm', 'mp3', 'm4a']
const num = (v: string): number | null => (v === '' ? null : Number(v))

export interface SettingsPanelProps {
  /** エンコード設定・バッチ設定・出力先を初期値に戻す */
  onReset: () => void
  batch: BatchSettings
  setBatch: React.Dispatch<React.SetStateAction<BatchSettings>>
  settings: EncodeSettings
  setSettings: React.Dispatch<React.SetStateAction<EncodeSettings>>
  /** null は検出中 */
  hwFound: string[] | null
  detect: () => Promise<void>
  running: boolean
  outDir: string | null
  setOutDir: (dir: string | null) => void
  ffmpegPath: string
  ffmpegError: string | null
  changeFfmpeg: (path: string | null) => Promise<void>
}

export function SettingsPanel({
  onReset,
  batch,
  setBatch,
  settings,
  setSettings,
  hwFound,
  detect,
  running,
  outDir,
  setOutDir,
  ffmpegPath,
  ffmpegError,
  changeFfmpeg
}: SettingsPanelProps): React.JSX.Element {
  const patch = (p: Partial<EncodeSettings>): void => setSettings((s) => ({ ...s, ...p }))
  const patchBatch = (p: Partial<BatchSettings>): void => setBatch((b) => ({ ...b, ...p }))
  const isAudioOnly = settings.videoCodec === null
  const noSubtitle = isAudioOnly || !(settings.container in SUBTITLE_NOTE)
  const speed = settings.videoCodec ? speedSpec(settings.videoCodec, settings.hwAccel) : null
  const encoderName = settings.videoCodec ? hwEncoderName(settings.videoCodec, settings.hwAccel) : null
  const encoderLabel = isAudioOnly
    ? '音声のみ(映像なし)'
    : `${HW_LABEL[settings.hwAccel]}${encoderName ? ` (${encoderName})` : ''}`

  return (
    <Card className="min-h-0 gap-3 overflow-auto py-4">
      <CardHeader className="flex flex-row items-center justify-between px-4">
        <CardTitle className="text-sm">エンコード設定</CardTitle>
        <Button size="sm" variant="ghost" disabled={running} onClick={onReset} title="設定をすべて初期値に戻します">
          <RotateCcw /> 初期値に戻す
        </Button>
      </CardHeader>
        <CardContent className="flex flex-col gap-3 px-4">
          <Field label="プリセット" hint="エンコーダ(CPU / NVENC など)もここで選びます。使えるハードウェアエンコーダだけが並びます。選ぶと詳細設定も初期値に戻ります">
            <Select
              value={settings.presetId}
              disabled={running}
              onValueChange={(v) => setSettings(applyPreset(v, hwFound ?? []))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectablePresets(hwFound, settings.presetId).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Tabs defaultValue="video" className="gap-3">
            <TabsList className="w-full">
              <TabsTrigger value="video">映像</TabsTrigger>
              <TabsTrigger value="audio">音声</TabsTrigger>
              <TabsTrigger value="subtitle">字幕</TabsTrigger>
              <TabsTrigger value="output">出力</TabsTrigger>
              <TabsTrigger value="batch">バッチ</TabsTrigger>
            </TabsList>

            <TabsContent value="subtitle" className="flex flex-col gap-3">
              <Field
                label="字幕"
                hint={
                  noSubtitle
                    ? '音声のみの出力、または字幕を持てないコンテナのため設定できません'
                    : settings.subtitleMode === 'copy'
                      ? `入力内の全字幕トラックを ${SUBTITLE_NOTE[settings.container] ?? ''} で格納します。画像字幕 (PGS 等) は mp4 / webm に入れられずエラーになります`
                      : settings.subtitleMode === 'burn'
                        ? '映像に文字を焼き付けます(オフにできません)。画像字幕も対象です'
                        : undefined
                }
              >
                <Select
                  value={settings.subtitleMode}
                  disabled={noSubtitle || running}
                  onValueChange={(v) => patch({ subtitleMode: v as SubtitleMode })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drop">字幕を含めない</SelectItem>
                    <SelectItem value="copy">字幕トラックを格納(ソフトサブ)</SelectItem>
                    <SelectItem value="burn">映像に焼き込む(ハードサブ)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {settings.subtitleMode === 'burn' && !noSubtitle && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="字幕トラック番号" hint="入力内の字幕トラックの順番(1 が最初)">
                    <Input
                      type="number"
                      min={1}
                      disabled={running}
                      value={settings.subtitleTrack + 1}
                      onChange={(e) => patch({ subtitleTrack: Math.max(0, Number(e.target.value) - 1) })}
                    />
                  </Field>
                  <Field label="フォントサイズ">
                    <Input
                      type="number"
                      min={1}
                      placeholder="字幕の指定に従う"
                      disabled={running}
                      value={settings.subtitleFontSize ?? ''}
                      onChange={(e) => patch({ subtitleFontSize: num(e.target.value) })}
                    />
                  </Field>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="strip-metadata" className="flex flex-col items-start gap-0.5">
                  メタデータとチャプターを除去
                  <span className="text-muted-foreground text-xs font-normal">
                    タイトル・撮影情報・チャプターを引き継ぎません (-map_metadata -1 -map_chapters -1)
                  </span>
                </Label>
                <Switch
                  id="strip-metadata"
                  checked={settings.stripMetadata}
                  disabled={running}
                  onCheckedChange={(v) => patch({ stripMetadata: v })}
                />
              </div>
            </TabsContent>

            <TabsContent value="video" className="flex flex-col gap-3">
              <Field
                label="エンコーダ"
                hint={settings.hwAccel !== 'none' ? 'HW エンコードでは CRF を同等の品質値 (CQ/QP) として扱います' : undefined}
              >
                <div className="flex items-center gap-2">
                  <div className="bg-muted min-w-0 flex-1 truncate rounded-md border px-3 py-2 text-sm">{encoderLabel}</div>
                  <Button variant="outline" disabled={running || hwFound === null} onClick={() => void detect()}>
                    <RotateCcw /> {hwFound === null ? '検出中…' : 'HW 再検出'}
                  </Button>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={speed ? `速度プリセット (${speed.flag})` : '速度プリセット'}>
                  <Select
                    value={speed && settings.speed && speed.options.includes(settings.speed) ? settings.speed : DEFAULT_SPEED}
                    disabled={isAudioOnly || running}
                    onValueChange={(v) => patch({ speed: v === DEFAULT_SPEED ? null : v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_SPEED}>
                        既定{speed?.default ? ` (${speed.default})` : ''}
                      </SelectItem>
                      {speed?.options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="レート制御">
                  <Select
                    value={settings.rateControl}
                    disabled={isAudioOnly || running}
                    onValueChange={(v) => patch({ rateControl: v as RateControl })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quality">品質指定 (CRF / CQ)</SelectItem>
                      <SelectItem value="bitrate">ビットレート指定</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {settings.rateControl === 'quality' ? (
                  <Field label="CRF">
                    <Input type="number" min={0} max={63} disabled={isAudioOnly} value={settings.crf} onChange={(e) => patch({ crf: Number(e.target.value) })} />
                  </Field>
                ) : (
                  <Field label="映像ビットレート (kbps)">
                    <Input type="number" min={100} step={100} disabled={isAudioOnly} value={settings.videoBitrateK} onChange={(e) => patch({ videoBitrateK: Number(e.target.value) })} />
                  </Field>
                )}
                <Field label="ピクセルフォーマット">
                  <Select
                    value={settings.pixFmt}
                    disabled={isAudioOnly || running}
                    onValueChange={(v) => patch({ pixFmt: v as PixFmt })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">自動</SelectItem>
                      <SelectItem value="yuv420p">yuv420p (8bit・互換性重視)</SelectItem>
                      <SelectItem value="yuv420p10le">yuv420p10le (10bit)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="高さ (px)">
                  <Input type="number" min={0} placeholder="元のまま" disabled={isAudioOnly} value={settings.height ?? ''} onChange={(e) => patch({ height: num(e.target.value) })} />
                </Field>
                <Field label="fps">
                  <Input type="number" min={0} placeholder="元のまま" disabled={isAudioOnly} value={settings.fps ?? ''} onChange={(e) => patch({ fps: num(e.target.value) })} />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="audio" className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="音声">
                  <Select
                    value={settings.audioMode}
                    disabled={running}
                    onValueChange={(v) => patch({ audioMode: v as AudioMode })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="encode">再エンコード</SelectItem>
                      <SelectItem value="copy">そのままコピー</SelectItem>
                      <SelectItem value="none" disabled={isAudioOnly}>
                        音声なし
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="コーデック">
                  <Select
                    value={settings.audioCodec}
                    disabled={settings.audioMode !== 'encode' || running}
                    onValueChange={(v) => patch({ audioCodec: v as EncodeSettings['audioCodec'] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aac">AAC</SelectItem>
                      <SelectItem value="libopus">Opus</SelectItem>
                      <SelectItem value="libmp3lame">MP3</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="ビットレート (kbps)">
                  <Input type="number" min={32} disabled={settings.audioMode !== 'encode'} value={settings.audioBitrateK} onChange={(e) => patch({ audioBitrateK: Number(e.target.value) })} />
                </Field>
                <Field label="チャンネル">
                  <Select
                    value={String(settings.audioChannels ?? 'keep')}
                    disabled={settings.audioMode !== 'encode' || running}
                    onValueChange={(v) => patch({ audioChannels: v === 'keep' ? null : (Number(v) as 1 | 2 | 6) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">元のまま</SelectItem>
                      <SelectItem value="1">モノラル</SelectItem>
                      <SelectItem value="2">ステレオ</SelectItem>
                      <SelectItem value="6">5.1ch</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="サンプルレート">
                  <Select
                    value={String(settings.sampleRate ?? 'keep')}
                    disabled={settings.audioMode !== 'encode' || running}
                    onValueChange={(v) => patch({ sampleRate: v === 'keep' ? null : (Number(v) as 44100 | 48000) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">元のまま</SelectItem>
                      <SelectItem value="44100">44.1 kHz</SelectItem>
                      <SelectItem value="48000">48 kHz</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="output" className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
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
                    <Input readOnly value={outDir ?? '入力と同じフォルダ'} title={outDir ?? undefined} className="min-w-0" />
                    <Button size="icon" variant="outline" disabled={running} onClick={async () => setOutDir((await window.api.openDir()) ?? outDir)}>
                      <FolderOpen />
                    </Button>
                  </div>
                </Field>
              </div>
              <Field
                label="出力ファイル名"
                hint={`{name} = 入力ファイル名、{preset} = プリセット。例: ${expandTemplate(batch.outputTemplate, { name: 'clip', preset: settings.presetId })}.${settings.container}`}
              >
                <Input
                  className="font-mono text-xs"
                  placeholder={DEFAULT_TEMPLATE}
                  disabled={running}
                  value={batch.outputTemplate}
                  onChange={(e) => patchBatch({ outputTemplate: e.target.value })}
                />
              </Field>
              <Field
                label="同名ファイルがあるとき"
                hint={
                  batch.onConflict === 'overwrite'
                    ? '既存ファイルを確認なしで上書きします'
                    : batch.onConflict === 'rename'
                      ? '「名前 (2).mp4」のように空いている名前で出力します'
                      : 'そのファイルは処理せず、スキップとして記録します'
                }
              >
                <Select
                  value={batch.onConflict}
                  disabled={running}
                  onValueChange={(v) => patchBatch({ onConflict: v as ConflictPolicy })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rename">別名で保存</SelectItem>
                    <SelectItem value="skip">スキップ</SelectItem>
                    <SelectItem value="overwrite">上書き</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="faststart" className="flex flex-col items-start gap-0.5">
                  faststart
                  <span className="text-muted-foreground text-xs font-normal">
                    mp4 / m4a の再生開始を速くする (-movflags +faststart)
                  </span>
                </Label>
                <Switch
                  id="faststart"
                  checked={settings.faststart}
                  disabled={running}
                  onCheckedChange={(v) => patch({ faststart: v })}
                />
              </div>
              <Field label="追加の ffmpeg 引数" hint={'出力ファイルの直前に追加されます。空白を含む値は "..." で囲みます'}>
                <Input
                  placeholder={'例: -metadata title="My Movie" -map_metadata -1'}
                  className="font-mono text-xs"
                  disabled={running}
                  value={settings.extraArgs}
                  onChange={(e) => patch({ extraArgs: e.target.value })}
                />
              </Field>
              <Field label="ffmpeg のパス" hint={ffmpegError && <span className="text-destructive">{ffmpegError}</span>}>
                <div className="flex gap-2">
                  <Input readOnly value={ffmpegPath} title={ffmpegPath} className="min-w-0" />
                  <Button size="icon" variant="outline" disabled={running} onClick={async () => changeFfmpeg(await window.api.openExe())}>
                    <FolderOpen />
                  </Button>
                  <Button variant="outline" disabled={running} onClick={async () => changeFfmpeg(await window.api.getDefaultFfmpegPath())}>
                    既定
                  </Button>
                </div>
              </Field>
            </TabsContent>

            <TabsContent value="batch" className="flex flex-col gap-3">
              <Field
                label="同時に処理するファイル数"
                hint="ハードウェアエンコードは同時に複数処理しても速くなりやすい一方、ソフトウェアエンコードは 1 件でも CPU を使い切るため 1 のままが無難です"
              >
                <Select
                  value={String(batch.concurrency)}
                  disabled={running}
                  onValueChange={(v) => patchBatch({ concurrency: Number(v) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} 件{n === 1 ? '(順番に処理)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="stop-on-error" className="flex flex-col items-start gap-0.5">
                  エラーが出たら中断する
                  <span className="text-muted-foreground text-xs font-normal">
                    オフの場合は失敗したファイルを飛ばして残りを続けます。実行後に「未完了のみ再実行」で再挑戦できます
                  </span>
                </Label>
                <Switch
                  id="stop-on-error"
                  checked={batch.stopOnError}
                  disabled={running}
                  onCheckedChange={(v) => patchBatch({ stopOnError: v })}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
    </Card>
  )
}
