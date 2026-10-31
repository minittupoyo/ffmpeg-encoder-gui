import { describe, expect, it } from 'vitest'
import { buildFfmpegArgs, defaultOutputPath, formatCommand } from './ffmpegArgs'
import { PRESETS } from './presets'

const preset = (id: string) => ({ presetId: id, ...PRESETS.find((p) => p.id === id)!.settings })

describe('buildFfmpegArgs', () => {
  it('H.264 の基本引数', () => {
    const a = buildFfmpegArgs('in.mov', 'out.mp4', preset('h264'))
    expect(a).toContain('libx264')
    expect(a.slice(a.indexOf('-crf'), a.indexOf('-crf') + 2)).toEqual(['-crf', '23'])
    expect(a.at(-1)).toBe('out.mp4')
    expect(a).toContain('pipe:1')
  })
  it('H.265 + mp4 は hvc1 タグ', () => {
    expect(buildFfmpegArgs('a', 'b', preset('h265'))).toContain('hvc1')
  })
  it('VP9 は -b:v 0', () => {
    const a = buildFfmpegArgs('a', 'b', preset('vp9'))
    expect(a[a.indexOf('-b:v') + 1]).toBe('0')
  })
  it('解像度と fps', () => {
    const a = buildFfmpegArgs('a', 'b', { ...preset('h264'), height: 720, fps: 30 })
    expect(a).toContain('scale=-2:720')
    expect(a[a.indexOf('-r') + 1]).toBe('30')
  })
  it('音声のみは -vn で映像引数なし', () => {
    const a = buildFfmpegArgs('a', 'b.mp3', preset('audio-mp3'))
    expect(a).toContain('-vn')
    expect(a).not.toContain('-crf')
    expect(a).toContain('libmp3lame')
  })
})

describe('defaultOutputPath', () => {
  it('拡張子を差し替える', () => {
    expect(defaultOutputPath('C:\\v\\clip.mov', 'mp4')).toBe('C:\\v\\clip_encoded.mp4')
  })
  it('出力先指定', () => {
    expect(defaultOutputPath('C:\\v\\clip.mov', 'mkv', 'D:\\out')).toBe('D:\\out\\clip_encoded.mkv')
  })
})

describe('formatCommand', () => {
  it('空白を含む引数をクォートする', () => {
    expect(formatCommand('C:\\ffmpeg\\ffmpeg.exe', ['-i', 'my video.mp4'])).toBe(
      'C:\\ffmpeg\\ffmpeg.exe -i "my video.mp4"'
    )
  })
})
