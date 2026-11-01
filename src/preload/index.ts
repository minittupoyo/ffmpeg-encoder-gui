import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { EncodeRequest, EncodeResult } from '../shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  openFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFiles'),
  addFolder: (): Promise<string[]> => ipcRenderer.invoke('dialog:addFolder'),
  /** フォルダを配下のメディアファイルに展開する(ファイルはそのまま) */
  expandPaths: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('files:expand', paths),
  openDir: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDir'),
  getFfmpegPath: (): Promise<string> => ipcRenderer.invoke('config:ffmpegPath'),
  /** 前回の画面設定(無ければ null)。内容は呼び出し側で検証する */
  loadUiState: (): Promise<unknown> => ipcRenderer.invoke('config:getUi'),
  saveUiState: (ui: unknown): Promise<void> => ipcRenderer.invoke('config:setUi', ui),
  getDefaultFfmpegPath: (): Promise<string> => ipcRenderer.invoke('config:defaultFfmpegPath'),
  /** 検証に通れば保存して null、だめならエラー文 */
  setFfmpegPath: (path: string): Promise<string | null> => ipcRenderer.invoke('config:setFfmpegPath', path),
  detectHw: (): Promise<string[]> => ipcRenderer.invoke('hw:detect'),
  revealInFolder: (path: string): void => ipcRenderer.send('shell:reveal', path),
  openExe: (): Promise<string | null> => ipcRenderer.invoke('dialog:openExe'),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  runEncode: (req: EncodeRequest): Promise<EncodeResult> => ipcRenderer.invoke('encode:run', req),
  cancelEncode: (id: string): void => ipcRenderer.send('encode:cancel', id),
  onProgress: (cb: (p: { id: string; percent: number }) => void) => subscribe('encode:progress', cb),
  onLog: (cb: (l: { id: string; line: string }) => void) => subscribe('encode:log', cb)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
