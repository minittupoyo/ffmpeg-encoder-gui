import { cpuFallbackId, presetAvailable, PRESETS } from '@shared/presets'
import type { EncodeSettings } from '@shared/types'

/** プリセットの設定を適用する。HW 版が検出結果に無い場合は同じコーデックの CPU 版にする */
export function applyPreset(id: string, found: string[] = []): EncodeSettings {
  let p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]
  if (!presetAvailable(p, found)) p = PRESETS.find((x) => x.id === cpuFallbackId(p.id)) ?? PRESETS[0]
  return { presetId: p.id, ...p.settings }
}

/** 検出結果が変わったとき、使えなくなった HW 版プリセットを CPU 版に戻す(他の設定は保つ) */
export function reconcileHw(s: EncodeSettings, found: string[]): EncodeSettings {
  const p = PRESETS.find((x) => x.id === s.presetId)
  if (!p || presetAvailable(p, found)) return s
  return { ...s, presetId: cpuFallbackId(p.id), hwAccel: 'none' }
}
