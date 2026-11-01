/** フォルダ追加で対象にするメディアファイルの拡張子 */
export const MEDIA_EXTENSIONS = [
  'mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'm4v', 'ts', 'mts', 'm2ts',
  'mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus'
]

export function isMediaFile(path: string): boolean {
  const dot = path.lastIndexOf('.')
  return dot >= 0 && MEDIA_EXTENSIONS.includes(path.slice(dot + 1).toLowerCase())
}
