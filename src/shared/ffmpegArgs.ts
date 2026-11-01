import { speedArgs, splitArgs } from './encoderOptions'
import { hwBitrateArgs, hwEncoderName, hwQualityArgs } from './hwEncoders'
import type { EncodeSettings, VideoCodec } from './types'

const VIDEO_ENCODER: Record<VideoCodec, string> = {
  h264: 'libx264',
  h265: 'libx265',
  av1: 'libsvtav1',
  vp9: 'libvpx-vp9'
}

/** コンテナごとの字幕コーデック。mp3 / m4a は字幕を持てない */
const SUBTITLE_CODEC: Partial<Record<string, string>> = { mp4: 'mov_text', mkv: 'copy', webm: 'webvtt' }

/** フィルタグラフ用にパスをエスケープする(`\`→`/`、`:` と `'` を退避し全体を '...' で囲む) */
export function escapeFilterPath(path: string): string {
  const p = path.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, `'\\\\\\''`)
  return `'${p}'`
}

/** 入力ファイル内の字幕トラックを映像に焼き込む subtitles フィルタ */
export function subtitlesFilter(input: string, track: number, fontSize: number | null): string {
  let f = `subtitles=${escapeFilterPath(input)}:si=${track}`
  if (fontSize !== null) f += `:force_style='FontSize=${fontSize}'`
  return f
}

/** ffmpeg の引数配列(実行ファイル名を含まない)を組み立てる純関数 */
export function buildFfmpegArgs(input: string, output: string, s: EncodeSettings): string[] {
  const args = ['-hide_banner', '-y', '-i', input]

  if (s.videoCodec === null) {
    args.push('-vn')
  } else {
    const hwName = hwEncoderName(s.videoCodec, s.hwAccel)
    const byBitrate = s.rateControl === 'bitrate'
    if (hwName && s.hwAccel !== 'none') {
      args.push(
        '-c:v', hwName,
        ...speedArgs(s.videoCodec, s.hwAccel, s.speed),
        ...(byBitrate ? hwBitrateArgs(s.hwAccel, s.videoBitrateK) : hwQualityArgs(s.hwAccel, s.crf))
      )
    } else {
      args.push('-c:v', VIDEO_ENCODER[s.videoCodec], ...speedArgs(s.videoCodec, 'none', s.speed))
      if (byBitrate) args.push('-b:v', `${s.videoBitrateK}k`)
      else args.push('-crf', String(s.crf), ...(s.videoCodec === 'vp9' ? ['-b:v', '0'] : []))
    }
    if (s.pixFmt !== 'auto') args.push('-pix_fmt', s.pixFmt)
    if (s.videoCodec === 'h265' && s.container === 'mp4') args.push('-tag:v', 'hvc1')
    const filters: string[] = []
    if (s.subtitleMode === 'burn') filters.push(subtitlesFilter(input, s.subtitleTrack, s.subtitleFontSize))
    if (s.height !== null) filters.push(`scale=-2:${s.height}`)
    if (filters.length > 0) args.push('-vf', filters.join(','))
    if (s.fps !== null) args.push('-r', String(s.fps))
  }

  // 映像なしで音声も無しでは出力が空になるため、その場合は音声を再エンコードする
  const audioMode = s.videoCodec === null && s.audioMode === 'none' ? 'encode' : s.audioMode
  if (audioMode === 'none') {
    args.push('-an')
  } else if (audioMode === 'copy') {
    args.push('-c:a', 'copy')
  } else {
    args.push('-c:a', s.audioCodec, '-b:a', `${s.audioBitrateK}k`)
    if (s.audioChannels !== null) args.push('-ac', String(s.audioChannels))
    if (s.sampleRate !== null) args.push('-ar', String(s.sampleRate))
  }

  // 字幕は映像ありで字幕を持てるコンテナのときだけ扱う(音声のみ出力では何もしない)
  const subCodec = s.videoCodec === null ? undefined : SUBTITLE_CODEC[s.container]
  if (subCodec) {
    if (s.subtitleMode === 'copy') args.push('-map', '0:v:0?', '-map', '0:a?', '-map', '0:s?', '-c:s', subCodec)
    else args.push('-sn')
  }
  if (s.stripMetadata) args.push('-map_metadata', '-1', '-map_chapters', '-1')

  if (s.faststart &&(s.container === 'mp4' || s.container === 'm4a')) args.push('-movflags', '+faststart')
  args.push(...splitArgs(s.extraArgs))
  args.push('-progress', 'pipe:1', '-nostats', output)
  return args
}

/** プレビュー用に Windows 向けクォートしたコマンド文字列を返す */
export function formatCommand(exe: string, args: string[]): string {
  const q = (a: string): string => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)
  return [exe, ...args].map(q).join(' ')
}
