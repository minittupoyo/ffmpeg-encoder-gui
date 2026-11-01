import { describe, expect, it } from 'vitest'
import { applyPreset, reconcileHw } from './settings'

describe('applyPreset', () => {
  it('HW 版は検出済みならそのまま適用する', () => {
    const s = applyPreset('h265-nvenc', ['h265:nvenc'])
    expect(s.presetId).toBe('h265-nvenc')
    expect(s.hwAccel).toBe('nvenc')
    expect(s.videoCodec).toBe('h265')
  })
  it('未検出の HW 版は同じコーデックの CPU 版になる', () => {
    const s = applyPreset('h265-nvenc', [])
    expect(s.presetId).toBe('h265')
    expect(s.hwAccel).toBe('none')
  })
  it('不明な ID は先頭のプリセット', () => {
    expect(applyPreset('nope').presetId).toBe('h264')
  })
})

describe('reconcileHw', () => {
  it('使えなくなった HW 版は CPU 版に戻し、他の設定は保つ', () => {
    const s = { ...applyPreset('h264-nvenc', ['h264:nvenc']), crf: 19, height: 720 }
    const r = reconcileHw(s, [])
    expect(r.presetId).toBe('h264')
    expect(r.hwAccel).toBe('none')
    expect(r.crf).toBe(19)
    expect(r.height).toBe(720)
  })
  it('使えるなら何もしない', () => {
    const s = applyPreset('h264-nvenc', ['h264:nvenc'])
    expect(reconcileHw(s, ['h264:nvenc'])).toBe(s)
  })
})
