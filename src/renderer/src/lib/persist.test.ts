import { describe, expect, it } from 'vitest'
import { DEFAULT_BATCH, restoreUiState, type UiState } from './persist'
import { applyPreset } from './settings'

const fallback: UiState = { settings: applyPreset('h264'), batch: DEFAULT_BATCH, outDir: null }

describe('restoreUiState', () => {
  it('保存した内容をそのまま復元できる', () => {
    const saved: UiState = {
      settings: { ...applyPreset('h265-nvenc', ['h265:nvenc']), crf: 24, height: 1080, extraArgs: '-map_metadata -1' },
      batch: { outputTemplate: '{name}-{preset}', onConflict: 'skip', stopOnError: true, concurrency: 3 },
      outDir: 'D:\\out'
    }
    // JSON を経由しても同じになる(実際の保存と同じ経路)
    expect(restoreUiState(JSON.parse(JSON.stringify(saved)), fallback)).toEqual(saved)
  })

  it('壊れた・空の入力は既定値を返す', () => {
    for (const raw of [null, undefined, 42, 'x', [], {}]) {
      expect(restoreUiState(raw, fallback)).toEqual(fallback)
    }
  })

  it('存在しないプリセットの設定は捨てる', () => {
    const raw = { settings: { presetId: 'gone', crf: 10 } }
    expect(restoreUiState(raw, fallback).settings).toEqual(fallback.settings)
  })

  it('不正な項目だけプリセットの既定値に戻し、正しい項目は残す', () => {
    const raw = { settings: { presetId: 'h264', crf: 999, container: 'avi', height: 720, faststart: 'yes' } }
    const s = restoreUiState(raw, fallback).settings
    expect(s.crf).toBe(23)
    expect(s.container).toBe('mp4')
    expect(s.faststart).toBe(true)
    expect(s.height).toBe(720)
  })

  it('未知のキーは取り込まない', () => {
    const raw = { settings: { presetId: 'h264', evil: 1 }, batch: { concurrency: 2, extra: true } }
    const r = restoreUiState(raw, fallback)
    expect(r.settings).not.toHaveProperty('evil')
    expect(r.batch).not.toHaveProperty('extra')
    expect(r.batch.concurrency).toBe(2)
  })

  it('バッチ設定の範囲外・型違いは既定値', () => {
    const r = restoreUiState({ batch: { concurrency: 99, onConflict: 'explode', stopOnError: 1 } }, fallback)
    expect(r.batch).toEqual(DEFAULT_BATCH)
  })

  it('出力先は空文字・文字列以外なら null', () => {
    expect(restoreUiState({ outDir: '' }, fallback).outDir).toBeNull()
    expect(restoreUiState({ outDir: 5 }, fallback).outDir).toBeNull()
    expect(restoreUiState({ outDir: 'E:\\x' }, fallback).outDir).toBe('E:\\x')
  })
})
