import { execFile } from 'child_process'
import { HW_LIST, hwEncoderName, hwKey } from '../shared/hwEncoders'
import type { VideoCodec } from '../shared/types'

const CODECS: VideoCodec[] = ['h264', 'h265', 'av1']

/** 極小のテスト映像を実際にエンコードして、そのエンコーダが使えるか確認する */
function tryEncoder(ffmpeg: string, encoder: string): Promise<boolean> {
  const args = [
    '-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=256x256:d=0.2:r=10',
    '-pix_fmt', 'yuv420p', '-c:v', encoder, '-f', 'null', '-'
  ]
  return new Promise((resolve) => {
    execFile(ffmpeg, args, { timeout: 15000, windowsHide: true }, (err) => resolve(!err))
  })
}

/** 使えるエンコーダのキー(例: `h264:nvenc`)の一覧を返す。GPU の競合を避けるため逐次実行 */
export async function detectHwEncoders(ffmpeg: string): Promise<string[]> {
  const found: string[] = []
  for (const codec of CODECS) {
    for (const hw of HW_LIST) {
      const name = hwEncoderName(codec, hw)
      if (name && (await tryEncoder(ffmpeg, name))) found.push(hwKey(codec, hw))
    }
  }
  return found
}
