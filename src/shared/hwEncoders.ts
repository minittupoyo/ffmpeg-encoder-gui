import type { HwAccel, VideoCodec } from './types'

/** ハードウェアエンコーダ名。VP9 には対応する HW エンコーダを扱わない */
const HW_ENCODERS: Partial<Record<VideoCodec, Record<Exclude<HwAccel, 'none'>, string>>> = {
  h264: { nvenc: 'h264_nvenc', qsv: 'h264_qsv', amf: 'h264_amf' },
  h265: { nvenc: 'hevc_nvenc', qsv: 'hevc_qsv', amf: 'hevc_amf' },
  av1: { nvenc: 'av1_nvenc', qsv: 'av1_qsv', amf: 'av1_amf' }
}

export const HW_LABEL: Record<HwAccel, string> = {
  none: 'ソフトウェア (CPU)',
  nvenc: 'NVIDIA NVENC',
  qsv: 'Intel QSV',
  amf: 'AMD AMF'
}

export const HW_LIST: Exclude<HwAccel, 'none'>[] = ['nvenc', 'qsv', 'amf']

export function hwEncoderName(codec: VideoCodec, hw: HwAccel): string | null {
  if (hw === 'none') return null
  return HW_ENCODERS[codec]?.[hw] ?? null
}

/** 検出結果に使うキー(例: `h264:nvenc`) */
export const hwKey = (codec: VideoCodec, hw: HwAccel): string => `${codec}:${hw}`

/** HW エンコーダごとの品質指定(CRF 相当の値を渡す) */
export function hwQualityArgs(hw: Exclude<HwAccel, 'none'>, q: number): string[] {
  switch (hw) {
    case 'nvenc':
      return ['-preset', 'p5', '-rc', 'vbr', '-cq', String(q), '-b:v', '0']
    case 'qsv':
      return ['-global_quality', String(q)]
    case 'amf':
      return ['-quality', 'quality', '-rc', 'cqp', '-qp_i', String(q), '-qp_p', String(q)]
  }
}
