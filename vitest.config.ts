import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// renderer 側のコードをテストできるよう、electron.vite.config.ts と同じエイリアスを張る
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  }
})
