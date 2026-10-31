import { describe, expect, it } from 'vitest'
import { buildFfmpegArgs, defaultOutputPath, formatCommand } from './ffmpegArgs'
import { PRESETS } from './presets'
import type { HwAccel } from './types'

const preset = (id: string, hwAccel: HwAccel = 'none') => ({
  presetId: id,
  hwAccel,
  ...PRESETS.find((p) => p.id === id)!.settings
})

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

describe('ハードウェアエンコード', () => {
  it('NVENC は hevc_nvenc と -cq を使う', () => {
    const a = buildFfmpegArgs('a', 'b.mp4', preset('h265', 'nvenc'))
    expect(a).toContain('hevc_nvenc')
    expect(a[a.indexOf('-cq') + 1]).toBe('28')
    expect(a).not.toContain('-crf')
    expect(a).toContain('hvc1')
  })
  it('QSV は -global_quality', () => {
    const a = buildFfmpegArgs('a', 'b.mp4', preset('h264', 'qsv'))
    expect(a).toContain('h264_qsv')
    expect(a[a.indexOf('-global_quality') + 1]).toBe('23')
  })
  it('AMF は cqp', () => {
    const a = buildFfmpegArgs('a', 'b.mkv', preset('av1', 'amf'))
    expect(a).toContain('av1_amf')
    expect(a[a.indexOf('-qp_i') + 1]).toBe('32')
  })
  it('VP9 は HW 指定でもソフトウェアにフォールバック', () => {
    const a = buildFfmpegArgs('a', 'b.webm', preset('vp9', 'nvenc'))
    expect(a).toContain('libvpx-vp9')
    expect(a).toContain('-crf')
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
