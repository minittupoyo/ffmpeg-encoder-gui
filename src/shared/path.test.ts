import { describe, expect, it } from 'vitest'
import { fileNameTailLen, splitPath, splitTail } from './path'

describe('splitPath', () => {
  it('Windows / POSIX 区切りを分ける', () => {
    expect(splitPath('C:\\v\\clip.mov')).toEqual({ dir: 'C:\\v', name: 'clip.mov' })
    expect(splitPath('/a/b.mp4')).toEqual({ dir: '/a', name: 'b.mp4' })
    expect(splitPath('x.mp4')).toEqual({ dir: '', name: 'x.mp4' })
  })
})

describe('splitTail', () => {
  it('短い文字列は分けない', () => {
    expect(splitTail('clip.mov', 8)).toEqual(['clip.mov', ''])
  })
  it('長い文字列は末尾を残して分ける', () => {
    expect(splitTail('a-very-long-file-name-0042.mov', 10)).toEqual(['a-very-long-file-nam', 'e-0042.mov'])
  })
})

describe('fileNameTailLen', () => {
  it('拡張子の手前まで末尾に含める', () => {
    const name = 'holiday-trip-final-cut-0042.mov'
    const [, tail] = splitTail(name, fileNameTailLen(name))
    expect(tail).toBe('t-0042.mov')
  })
  it('拡張子が無くても動く', () => {
    expect(fileNameTailLen('README')).toBe(10)
  })
})
