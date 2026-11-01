/** パスをフォルダ部とファイル名に分ける(`\` と `/` の両方に対応) */
export function splitPath(path: string): { dir: string; name: string } {
  const i = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return i < 0 ? { dir: '', name: path } : { dir: path.slice(0, i), name: path.slice(i + 1) }
}

/** 文字列を [先頭, 末尾] に分ける。CSS で先頭だけを省略表示し、末尾は常に見せるために使う */
export function splitTail(text: string, tailLen: number): [string, string] {
  if (text.length <= tailLen * 2) return [text, '']
  return [text.slice(0, text.length - tailLen), text.slice(text.length - tailLen)]
}

/** ファイル名の末尾として残す長さ: 拡張子(ドット込み)と、その直前の数文字 */
export function fileNameTailLen(name: string, before = 6): number {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.length - dot + before : before + 4
}
