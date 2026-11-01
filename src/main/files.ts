import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { isMediaFile } from '../shared/media'

const MAX_FILES = 10000

/** ドロップ/選択されたパスを展開する。フォルダは配下のメディアファイルを再帰的に集め、ファイルはそのまま通す */
export async function expandPaths(paths: string[]): Promise<string[]> {
  const out: string[] = []

  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return // 権限がない等で読めないフォルダは飛ばす
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return
      const full = join(dir, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.isFile() && isMediaFile(e.name)) out.push(full)
    }
  }

  for (const p of paths) {
    try {
      if ((await stat(p)).isDirectory()) await walk(p)
      else out.push(p)
    } catch {
      // 存在しないパスは無視する
    }
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}
