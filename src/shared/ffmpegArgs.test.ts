import { describe, expect, it } from 'vitest'
import { splitArgs } from './encoderOptions'
import { buildFfmpegArgs, escapeFilterPath, formatCommand } from './ffmpegArgs'
import { PRESETS } from './presets'
import type { HwAccel } from './types'

const preset = (id: string, hwAccel: HwAccel = 'none') => ({
  presetId: id,
  ...PRESETS.find((p) => p.id === id)!.settings,
  hwAccel
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

describe('詳細設定', () => {
  const base = preset('h264')
  const at = (a: string[], flag: string): string => a[a.indexOf(flag) + 1]

  it('ソフトウェアの速度プリセット', () => {
    expect(at(buildFfmpegArgs('a', 'b', { ...base, speed: 'slow' }), '-preset')).toBe('slow')
  })
  it('無効な速度値は無視する(コーデック切り替え時の取り残し)', () => {
    expect(buildFfmpegArgs('a', 'b', { ...base, speed: 'p7' })).not.toContain('-preset')
  })
  it('NVENC の既定は p5、指定すれば上書き', () => {
    expect(at(buildFfmpegArgs('a', 'b', preset('h264', 'nvenc')), '-preset')).toBe('p5')
    expect(at(buildFfmpegArgs('a', 'b', { ...preset('h264', 'nvenc'), speed: 'p7' }), '-preset')).toBe('p7')
  })
  it('ビットレート指定では -crf を付けない', () => {
    const a = buildFfmpegArgs('a', 'b', { ...base, rateControl: 'bitrate', videoBitrateK: 8000 })
    expect(at(a, '-b:v')).toBe('8000k')
    expect(a).not.toContain('-crf')
  })
  it('NVENC のビットレート指定', () => {
    const a = buildFfmpegArgs('a', 'b', { ...preset('h265', 'nvenc'), rateControl: 'bitrate', videoBitrateK: 6000 })
    expect(at(a, '-b:v')).toBe('6000k')
    expect(a).not.toContain('-cq')
  })
  it('pix_fmt と faststart', () => {
    const a = buildFfmpegArgs('a', 'b.mp4', { ...base, pixFmt: 'yuv420p10le' })
    expect(at(a, '-pix_fmt')).toBe('yuv420p10le')
    expect(at(a, '-movflags')).toBe('+faststart')
    expect(buildFfmpegArgs('a', 'b.mkv', { ...preset('av1') })).not.toContain('-movflags')
  })
  it('音声: コピー / なし / チャンネルとサンプルレート', () => {
    expect(buildFfmpegArgs('a', 'b', { ...base, audioMode: 'copy' })).toContain('copy')
    const none = buildFfmpegArgs('a', 'b', { ...base, audioMode: 'none' })
    expect(none).toContain('-an')
    expect(none).not.toContain('-b:a')
    const a = buildFfmpegArgs('a', 'b', { ...base, audioChannels: 2, sampleRate: 48000 })
    expect(at(a, '-ac')).toBe('2')
    expect(at(a, '-ar')).toBe('48000')
  })
  it('音声のみで audioMode none なら再エンコードにフォールバック', () => {
    expect(buildFfmpegArgs('a', 'b.mp3', { ...preset('audio-mp3'), audioMode: 'none' })).toContain('libmp3lame')
  })
  it('追加引数は出力の直前に入る', () => {
    const a = buildFfmpegArgs('a', 'out.mp4', { ...base, extraArgs: '-metadata title="My Movie" -map_metadata -1' })
    expect(a.slice(-8, -5)).toEqual(['-metadata', 'title=My Movie', '-map_metadata'])
    expect(a.at(-1)).toBe('out.mp4')
    expect(a.indexOf('-metadata')).toBeLessThan(a.indexOf('-progress'))
  })
})

describe('字幕とメタデータ', () => {
  const base = preset('h264')
  const at = (a: string[], flag: string): string => a[a.indexOf(flag) + 1]

  it('既定では字幕を含めない', () => {
    expect(buildFfmpegArgs('a', 'b.mp4', base)).toContain('-sn')
  })
  it('コピーは全字幕トラックをコンテナ別コーデックで格納', () => {
    const mp4 = buildFfmpegArgs('a', 'b.mp4', { ...base, subtitleMode: 'copy' })
    expect(at(mp4, '-c:s')).toBe('mov_text')
    expect(mp4).toContain('0:s?')
    expect(mp4).not.toContain('-sn')
    expect(at(buildFfmpegArgs('a', 'b.mkv', { ...preset('av1'), subtitleMode: 'copy' }), '-c:s')).toBe('copy')
    expect(at(buildFfmpegArgs('a', 'b.webm', { ...preset('vp9'), subtitleMode: 'copy' }), '-c:s')).toBe('webvtt')
  })
  it('焼き込みは subtitles フィルタを scale より前に置き、字幕ストリームは出力しない', () => {
    const a = buildFfmpegArgs('C:\\v\\in.mkv', 'b.mp4', { ...base, subtitleMode: 'burn', subtitleTrack: 1, height: 720 })
    expect(at(a, '-vf')).toBe("subtitles='C\\:/v/in.mkv':si=1,scale=-2:720")
    expect(a).toContain('-sn')
  })
  it('フォントサイズは force_style で指定', () => {
    const a = buildFfmpegArgs('in.mkv', 'b.mp4', { ...base, subtitleMode: 'burn', subtitleFontSize: 28 })
    expect(at(a, '-vf')).toContain("force_style='FontSize=28'")
  })
  it('パスの引用符とコロンを退避する', () => {
    expect(escapeFilterPath("D:\\it's\\a.mkv")).toBe("'D\\:/it'\\\\\\''s/a.mkv'")
  })
  it('音声のみ出力では字幕引数を付けない', () => {
    const a = buildFfmpegArgs('a', 'b.mp3', { ...preset('audio-mp3'), subtitleMode: 'copy' })
    expect(a).not.toContain('-sn')
    expect(a).not.toContain('-c:s')
  })
  it('メタデータとチャプターを除去', () => {
    const a = buildFfmpegArgs('a', 'b.mp4', { ...base, stripMetadata: true })
    expect(at(a, '-map_metadata')).toBe('-1')
    expect(at(a, '-map_chapters')).toBe('-1')
  })
})

describe('splitArgs', () => {
  it('空白・クォート・空文字', () => {
    expect(splitArgs('')).toEqual([])
    expect(splitArgs('  -a  b ')).toEqual(['-a', 'b'])
    expect(splitArgs('-metadata "t=a b" -x')).toEqual(['-metadata', 't=a b', '-x'])
  })
})

describe('formatCommand', () => {
  it('空白を含む引数をクォートする', () => {
    expect(formatCommand('C:\\ffmpeg\\ffmpeg.exe', ['-i', 'my video.mp4'])).toBe(
      'C:\\ffmpeg\\ffmpeg.exe -i "my video.mp4"'
    )
  })
})
