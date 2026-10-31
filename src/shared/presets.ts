import type { Preset } from './types'

export const PRESETS: Preset[] = [
  { id: 'h264', label: 'H.264 (MP4)', settings: { videoCodec: 'h264', audioCodec: 'aac', crf: 23, height: null, fps: null, audioBitrateK: 160, container: 'mp4' } },
  { id: 'h265', label: 'H.265 (MP4)', settings: { videoCodec: 'h265', audioCodec: 'aac', crf: 28, height: null, fps: null, audioBitrateK: 160, container: 'mp4' } },
  { id: 'av1', label: 'AV1 (MKV)', settings: { videoCodec: 'av1', audioCodec: 'libopus', crf: 32, height: null, fps: null, audioBitrateK: 128, container: 'mkv' } },
  { id: 'vp9', label: 'VP9 (WebM)', settings: { videoCodec: 'vp9', audioCodec: 'libopus', crf: 31, height: null, fps: null, audioBitrateK: 128, container: 'webm' } },
  { id: 'audio-mp3', label: '音声のみ (MP3)', settings: { videoCodec: null, audioCodec: 'libmp3lame', crf: 0, height: null, fps: null, audioBitrateK: 192, container: 'mp3' } },
  { id: 'audio-m4a', label: '音声のみ (M4A)', settings: { videoCodec: null, audioCodec: 'aac', crf: 0, height: null, fps: null, audioBitrateK: 192, container: 'm4a' } }
]
