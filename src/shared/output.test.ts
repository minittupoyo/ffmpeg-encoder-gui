import { describe, expect, it } from 'vitest'
import { expandTemplate, resolveOutputPath, samePath, uniquePath } from './output'

describe('expandTemplate', () => {
  it('{name} と {preset} を展開する', () => {
    expect(expandTemplate('{name}_{preset}', { name: 'clip', preset: 'h265' })).toBe('clip_h265')
  })
  it('空のテンプレートは既定にフォールバック', () => {
    expect(expandTemplate('  ', { name: 'clip', preset: 'h264' })).toBe('clip_encoded')
  })
  it('ファイル名に使えない文字は置換する', () => {
    expect(expandTemplate('a/b:c', { name: 'x', preset: 'p' })).toBe('a_b_c')
  })
  it('展開結果が空になる場合は入力名を使う', () => {
    expect(expandTemplate('...', { name: 'clip', preset: 'p' })).toBe('clip')
  })
})

describe('resolveOutputPath', () => {
  it('既定テンプレートは _encoded を付けて拡張子を差し替える', () => {
    expect(resolveOutputPath('C:\\v\\clip.mov', 'mp4', null, '{name}_encoded', 'h264')).toBe('C:\\v\\clip_encoded.mp4')
  })
  it('出力先とテンプレートを指定できる', () => {
    expect(resolveOutputPath('C:\\v\\clip.mov', 'mkv', 'D:\\out', '{name}-{preset}', 'av1')).toBe('D:\\out\\clip-av1.mkv')
  })
  it('名前に複数のドットがあっても最後だけ拡張子として扱う', () => {
    expect(resolveOutputPath('C:\\v\\a.b.c.mov', 'mp4', null, '{name}', 'h264')).toBe('C:\\v\\a.b.c.mp4')
  })
})

describe('samePath', () => {
  it('区切り文字と大文字小文字の違いを無視する', () => {
    expect(samePath('C:/V/Clip.MP4', 'c:\\v\\clip.mp4')).toBe(true)
    expect(samePath('C:\\v\\a.mp4', 'C:\\v\\b.mp4')).toBe(false)
  })
})

describe('uniquePath', () => {
  it('存在しなければそのまま', () => {
    expect(uniquePath('C:\\v\\a.mp4', () => false)).toBe('C:\\v\\a.mp4')
  })
  it('空き番号まで進める', () => {
    const taken = new Set(['C:\\v\\a.mp4', 'C:\\v\\a (2).mp4'])
    expect(uniquePath('C:\\v\\a.mp4', (p) => taken.has(p))).toBe('C:\\v\\a (3).mp4')
  })
  it('拡張子が無いパスでも動く', () => {
    expect(uniquePath('C:\\v.d\\a', (p) => p === 'C:\\v.d\\a')).toBe('C:\\v.d\\a (2)')
  })
})
