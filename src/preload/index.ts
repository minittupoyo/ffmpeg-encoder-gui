import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { EncodeRequest, EncodeResult } from '../shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  openFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFiles'),
  openDir: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDir'),
  getFfmpegPath: (): Promise<string> => ipcRenderer.invoke('config:ffmpegPath'),
  getDefaultFfmpegPath: (): Promise<string> => ipcRenderer.invoke('config:defaultFfmpegPath'),
  /** 検証に通れば保存して null、だめならエラー文 */
  setFfmpegPath: (path: string): Promise<string | null> => ipcRenderer.invoke('config:setFfmpegPath', path),
  detectHw: (): Promise<string[]> => ipcRenderer.invoke('hw:detect'),
  openExe: (): Promise<string | null> => ipcRenderer.invoke('dialog:openExe'),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  runEncode: (req: EncodeRequest): Promise<EncodeResult> => ipcRenderer.invoke('encode:run', req),
  cancelEncode: (id: string): void => ipcRenderer.send('encode:cancel', id),
  onProgress: (cb: (p: { id: string; percent: number }) => void) => subscribe('encode:progress', cb),
  onLog: (cb: (l: { id: string; line: string }) => void) => subscribe('encode:log', cb)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
