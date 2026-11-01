import { describe, expect, it } from 'vitest'
import { buildFfmpegArgs } from './ffmpegArgs'
import { cpuFallbackId, PRESETS, presetAvailable, selectablePresets } from './presets'

describe('PRESETS', () => {
  it('H.264 / HEVC / AV1 に CPU と各ハードウェアの版がある', () => {
    const labels = PRESETS.map((p) => p.label)
    for (const name of ['H.264', 'HEVC', 'AV1']) {
      for (const enc of ['CPU', 'NVENC', 'QSV', 'AMF']) expect(labels).toContain(`${name} (${enc})`)
    }
  })
  it('VP9 と音声のみは CPU 版だけ', () => {
    expect(PRESETS.filter((p) => p.family === 'vp9')).toHaveLength(1)
    expect(PRESETS.filter((p) => p.settings.videoCodec === null).every((p) => p.settings.hwAccel === 'none')).toBe(true)
  })
  it('id が重複しない', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
  })
  it('プリセットの hwAccel がそのまま ffmpeg のエンコーダになる', () => {
    const p = PRESETS.find((x) => x.id === 'h265-nvenc')!
    const args = buildFfmpegArgs('a', 'b.mp4', { presetId: p.id, ...p.settings })
    expect(args).toContain('hevc_nvenc')
    const cpu = PRESETS.find((x) => x.id === 'h265')!
    expect(buildFfmpegArgs('a', 'b.mp4', { presetId: cpu.id, ...cpu.settings })).toContain('libx265')
  })
})

describe('selectablePresets', () => {
  const ids = (found: string[] | null, current = 'h264'): string[] => selectablePresets(found, current).map((p) => p.id)

  it('検出前・検出なしでは CPU 版と音声のみだけ', () => {
    expect(ids(null)).toEqual(['h264', 'h265', 'av1', 'vp9', 'audio-mp3', 'audio-m4a'])
    expect(ids([])).toEqual(ids(null))
  })
  it('検出できた HW 版だけが加わる', () => {
    const list = ids(['h264:nvenc', 'h265:nvenc'])
    expect(list).toContain('h264-nvenc')
    expect(list).toContain('h265-nvenc')
    expect(list).not.toContain('av1-nvenc')
    expect(list).not.toContain('h264-qsv')
  })
  it('選択中のプリセットは検出し直し中でも残る', () => {
    expect(ids(null, 'h264-nvenc')).toContain('h264-nvenc')
  })
})

describe('presetAvailable / cpuFallbackId', () => {
  it('HW 版は検出結果に依存し、CPU 版は常に使える', () => {
    const nv = PRESETS.find((p) => p.id === 'h264-nvenc')!
    expect(presetAvailable(nv, [])).toBe(false)
    expect(presetAvailable(nv, ['h264:nvenc'])).toBe(true)
    expect(presetAvailable(PRESETS.find((p) => p.id === 'h264')!, [])).toBe(true)
  })
  it('代替は同じコーデックの CPU 版', () => {
    expect(cpuFallbackId('av1-amf')).toBe('av1')
    expect(cpuFallbackId('h264')).toBe('h264')
    expect(cpuFallbackId('audio-mp3')).toBe('audio-mp3')
  })
})
