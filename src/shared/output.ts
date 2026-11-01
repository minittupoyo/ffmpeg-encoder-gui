export const DEFAULT_TEMPLATE = '{name}_encoded'

/** 出力ファイル名(拡張子なし)のテンプレートを展開する。使えるのは {name}(入力名)と {preset}(プリセット ID) */
export function expandTemplate(template: string, vars: { name: string; preset: string }): string {
  const t = template.trim() || DEFAULT_TEMPLATE
  const s = t
    .replace(/\{(name|preset)\}/g, (_, k: 'name' | 'preset') => vars[k])
    // Windows のファイル名に使えない文字と、末尾のドット・空白を除く
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/[. ]+$/, '')
  return s || vars.name
}

/** 入力パス・コンテナ・出力先・テンプレートから出力ファイルのパスを導出する(存在確認はしない) */
export function resolveOutputPath(
  input: string,
  container: string,
  outDir: string | null,
  template: string,
  presetId: string
): string {
  const sep = Math.max(input.lastIndexOf('\\'), input.lastIndexOf('/'))
  const dir = outDir ?? (sep >= 0 ? input.slice(0, sep) : '.')
  const file = sep >= 0 ? input.slice(sep + 1) : input
  const dot = file.lastIndexOf('.')
  const name = dot > 0 ? file.slice(0, dot) : file
  return `${dir}\\${expandTemplate(template, { name, preset: presetId })}.${container}`
}

const norm = (p: string): string => p.replace(/\//g, '\\').toLowerCase()

/** Windows のパスとして同一か(区切り文字の違いと大文字小文字を無視) */
export function samePath(a: string, b: string): boolean {
  return norm(a) === norm(b)
}

/** 既に存在するなら `name (2).ext`、`name (3).ext` … と空いている名前を探す */
export function uniquePath(path: string, exists: (p: string) => boolean): string {
  if (!exists(path)) return path
  const dot = path.lastIndexOf('.')
  const sep = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  const hasExt = dot > sep + 1
  const base = hasExt ? path.slice(0, dot) : path
  const ext = hasExt ? path.slice(dot) : ''
  for (let n = 2; n < 10000; n++) {
    const candidate = `${base} (${n})${ext}`
    if (!exists(candidate)) return candidate
  }
  return path
}
