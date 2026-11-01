import { execFile, spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { stat, unlink } from 'fs/promises'
import type { WebContents } from 'electron'
import { buildFfmpegArgs } from '../shared/ffmpegArgs'
import { resolveOutputPath, samePath, uniquePath } from '../shared/output'
import { createProgressParser, progressPercent } from '../shared/progress'
import type { EncodeRequest, EncodeResult, ProgressStats } from '../shared/types'

/** 実行中(ffprobe 中を含む)のジョブ。child は spawn 後に入る */
const running = new Map<string, { child?: ChildProcess; canceled: boolean }>()

function probeDuration(ffprobe: string, input: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      ffprobe,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', input],
      (err, stdout) => resolve(err ? 0 : Number(stdout.trim()) || 0)
    )
  })
}

export async function runEncode(
  sender: WebContents,
  ffmpegPath: string,
  req: EncodeRequest
): Promise<EncodeResult> {
  const log = (line: string): void => {
    if (!sender.isDestroyed()) sender.send('encode:log', { id: req.id, line })
  }
  const progress = (percent: number, stats: ProgressStats): void => {
    if (!sender.isDestroyed()) sender.send('encode:progress', { id: req.id, percent, stats })
  }

  // 出力パスの決定。入力そのものを上書きしないよう、同一パスのときは上書き指定でも別名にする
  let output = resolveOutputPath(req.input, req.settings.container, req.outDir, req.outputTemplate, req.settings.presetId)
  let policy = req.onConflict
  if (samePath(output, req.input) && policy === 'overwrite') policy = 'rename'
  if (existsSync(output)) {
    if (policy === 'skip') {
      log(`スキップ: 出力ファイルが既に存在します: ${output}`)
      return { status: 'skipped', code: null, output }
    }
    if (policy === 'rename') {
      output = uniquePath(output, existsSync)
      log(`同名ファイルがあるため別名で出力します: ${output}`)
    }
  }

  const entry: { child?: ChildProcess; canceled: boolean } = { canceled: false }
  running.set(req.id, entry)

  const args = buildFfmpegArgs(req.input, output, req.settings)
  const ffprobe = ffmpegPath.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1')
  const duration = await probeDuration(ffprobe, req.input)

  // ffprobe 中にキャンセルされた場合は ffmpeg を起動しない
  if (entry.canceled) {
    running.delete(req.id)
    return { status: 'canceled', code: null, output }
  }

  return new Promise<EncodeResult>((resolve) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true })
    entry.child = child

    let last: ProgressStats = { outTimeSec: null, frame: null, fps: null, speed: null, bitrateKbps: null, sizeBytes: null, durationSec: duration, ended: false }
    const feed = createProgressParser((info) => {
      last = { ...info, durationSec: duration }
      // 開始直後など出力時間がまだ取れないブロックは、進捗バーを動かさないため送らない
      if (info.outTimeSec !== null) progress(progressPercent(info.outTimeSec, duration), last)
    })
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', feed)
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (d: string) => d.split(/\r?\n/).filter(Boolean).forEach(log))

    child.on('error', (e) => {
      running.delete(req.id)
      log(`起動失敗: ${e.message}`)
      resolve({ status: 'error', code: null, output })
    })
    child.on('close', async (code) => {
      running.delete(req.id)
      if (entry.canceled) {
        await unlink(output).catch(() => {})
        resolve({ status: 'canceled', code, output })
      } else if (code === 0) {
        progress(100, { ...last, outTimeSec: duration > 0 ? duration : last.outTimeSec, ended: true })
        const [inputSize, outputSize] = await Promise.all(
          [req.input, output].map((f) => stat(f).then((s) => s.size).catch(() => undefined))
        )
        resolve({ status: 'done', code, output, inputSize, outputSize })
      } else {
        resolve({ status: 'error', code, output })
      }
    })
  })
}

export function cancelEncode(id: string): void {
  const e = running.get(id)
  if (!e) return
  e.canceled = true
  const child = e.child
  if (!child) return
  // 'q' で ffmpeg に正常終了させ、止まらなければ強制終了
  child.stdin?.write('q')
  setTimeout(() => child.kill(), 3000)
}
