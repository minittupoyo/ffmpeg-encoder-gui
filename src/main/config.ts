import { execFile } from 'child_process'
import { app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export const DEFAULT_FFMPEG_PATH = 'C:\\ffmpeg\\ffmpeg.exe'

interface Config {
  ffmpegPath: string
}

const file = (): string => join(app.getPath('userData'), 'config.json')

let cache: Config | null = null

async function load(): Promise<Config> {
  if (cache) return cache
  try {
    const raw = JSON.parse(await readFile(file(), 'utf8')) as Partial<Config>
    cache = { ffmpegPath: raw.ffmpegPath || DEFAULT_FFMPEG_PATH }
  } catch {
    cache = { ffmpegPath: DEFAULT_FFMPEG_PATH }
  }
  return cache
}

export async function getFfmpegPath(): Promise<string> {
  return (await load()).ffmpegPath
}

/** `-version` を実行して ffmpeg として使えるか確認する。使えれば null、だめならエラー文を返す */
export function checkFfmpeg(path: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(path, ['-version'], { timeout: 5000, windowsHide: true }, (err, stdout) => {
      if (err) resolve(`実行できません: ${err.message.split('\n')[0]}`)
      else if (!/^ffmpeg version/i.test(stdout)) resolve('ffmpeg の実行ファイルではありません')
      else resolve(null)
    })
  })
}

/** 検証に通った場合のみ保存する。結果としてエラー文(成功時は null)を返す */
export async function setFfmpegPath(path: string): Promise<string | null> {
  const error = await checkFfmpeg(path)
  if (error) return error
  const cfg = await load()
  cfg.ffmpegPath = path
  await writeFile(file(), JSON.stringify(cfg, null, 2), 'utf8')
  return null
}
