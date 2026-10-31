import { hwEncoderName, hwQualityArgs } from './hwEncoders'
import type { EncodeSettings, VideoCodec } from './types'

const VIDEO_ENCODER: Record<VideoCodec, string> = {
  h264: 'libx264',
  h265: 'libx265',
  av1: 'libsvtav1',
  vp9: 'libvpx-vp9'
}

/** 出力ファイルパスを入力パスから導出する(拡張子差し替え + 同名衝突回避のため `_encoded` を付与) */
export function defaultOutputPath(input: string, container: string, outDir?: string): string {
  const sep = Math.max(input.lastIndexOf('\\'),input.lastIndexOf('/'))
  const dir = outDir ?? (sep >= 0 ? input.slice(0, sep) : '.')
  const file = sep >= 0 ? input.slice(sep + 1) : input
  const dot = file.lastIndexOf('.')
  const base = dot > 0 ? file.slice(0, dot) : file
  return `${dir}\\${base}_encoded.${container}`
}

/** ffmpeg の引数配列(実行ファイル名を含まない)を組み立てる純関数 */
export function buildFfmpegArgs(input: string, output: string, s: EncodeSettings): string[] {
  const args = ['-hide_banner', '-y', '-i', input]

  if (s.videoCodec === null) {
    args.push('-vn')
  } else {
    const hwName = hwEncoderName(s.videoCodec, s.hwAccel)
    if (hwName && s.hwAccel !== 'none') {
      args.push('-c:v', hwName, ...hwQualityArgs(s.hwAccel, s.crf))
    } else {
      args.push('-c:v', VIDEO_ENCODER[s.videoCodec], '-crf', String(s.crf))
      if (s.videoCodec === 'vp9') args.push('-b:v', '0')
    }
    if (s.videoCodec === 'h265' && s.container === 'mp4') args.push('-tag:v', 'hvc1')
    if (s.height !== null) args.push('-vf', `scale=-2:${s.height}`)
    if (s.fps !== null) args.push('-r', String(s.fps))
  }

  args.push('-c:a', s.audioCodec, '-b:a', `${s.audioBitrateK}k`)
  args.push('-progress', 'pipe:1', '-nostats', output)
  return args
}

/** プレビュー用に Windows 向けクォートしたコマンド文字列を返す */
export function formatCommand(exe: string, args: string[]): string {
  const q = (a: string): string => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)
  return [exe, ...args].map(q).join(' ')
}
