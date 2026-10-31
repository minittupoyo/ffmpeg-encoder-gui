import { execFile, spawn, type ChildProcess } from 'child_process'
import { unlink } from 'fs/promises'
import type { WebContents } from 'electron'
import { buildFfmpegArgs, defaultOutputPath } from '../shared/ffmpegArgs'
import { createProgressParser, progressPercent } from '../shared/progress'
import type { EncodeRequest, EncodeResult } from '../shared/types'

const running = new Map<string, { child: ChildProcess; canceled: boolean }>()

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
  const output = defaultOutputPath(req.input, req.settings.container, req.outDir ?? undefined)
  const args = buildFfmpegArgs(req.input, output, req.settings)
  const ffprobe = ffmpegPath.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1')
  const duration = await probeDuration(ffprobe, req.input)

  const log = (line: string): void => {
    if (!sender.isDestroyed()) sender.send('encode:log', { id: req.id, line })
  }
  const progress = (percent: number): void => {
    if (!sender.isDestroyed()) sender.send('encode:progress', { id: req.id, percent })
  }

  return new Promise<EncodeResult>((resolve) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true })
    const entry = { child, canceled: false }
    running.set(req.id, entry)

    const feed = createProgressParser((sec) => progress(progressPercent(sec, duration)))
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', feed)
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (d: string) => d.split(/\r?\n/).filter(Boolean).forEach(log))

    child.on('error', (e) => {
      running.delete(req.id)
      log(`起動失敗: ${e.message}`)
      resolve({ status: 'error', code: null })
    })
    child.on('close', async (code) => {
      running.delete(req.id)
      if (entry.canceled) {
        await unlink(output).catch(() => {})
        resolve({ status: 'canceled', code })
      } else if (code === 0) {
        progress(100)
        resolve({ status: 'done', code })
      } else {
        resolve({ status: 'error', code })
      }
    })
  })
}

export function cancelEncode(id: string): void {
  const e = running.get(id)
  if (!e) return
  e.canceled = true
  // 'q' で ffmpeg に正常終了させ、止まらなければ強制終了
  e.child.stdin?.write('q')
  setTimeout(() => e.child.kill(), 3000)
}
