import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { cancelEncode, runEncode } from './encoder'
import { expandPaths } from './files'
import { detectHwEncoders } from './hwDetect'
import { MEDIA_EXTENSIONS } from '../shared/media'
import { DEFAULT_FFMPEG_PATH, getFfmpegPath, getUiState, setFfmpegPath, setUiState } from './config'
import type { EncodeRequest } from '../shared/types'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('dialog:openFiles', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Media',
        extensions: MEDIA_EXTENSIONS
      }
    ]
  })
  return r.canceled ? [] : r.filePaths
})

ipcMain.handle('dialog:addFolder', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return r.canceled ? [] : expandPaths(r.filePaths)
})

ipcMain.handle('files:expand', (_e, paths: unknown) =>
  Array.isArray(paths) ? expandPaths(paths.filter((p): p is string => typeof p === 'string')) : []
)

ipcMain.handle('dialog:openDir', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('dialog:openExe', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'ffmpeg', extensions: ['exe'] }]
  })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('config:ffmpegPath', () => getFfmpegPath())
ipcMain.handle('config:getUi', () => getUiState())
ipcMain.handle('config:setUi', (_e, ui: unknown) => setUiState(ui))
ipcMain.handle('config:defaultFfmpegPath', () => DEFAULT_FFMPEG_PATH)
ipcMain.handle('config:setFfmpegPath', (_e, path: string) => setFfmpegPath(path))

ipcMain.on('shell:reveal', (_e, path: unknown) => {
  if (typeof path === 'string' && path) shell.showItemInFolder(path)
})

ipcMain.handle('hw:detect', async () => detectHwEncoders(await getFfmpegPath()))

ipcMain.handle('encode:run', async (e, req: EncodeRequest) =>
  runEncode(e.sender, await getFfmpegPath(), req)
)
ipcMain.on('encode:cancel', (_e, id: string) => cancelEncode(id))

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
