import { createHash } from 'node:crypto'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const shortHash = (contents) => createHash('sha256').update(contents).digest('hex').slice(0, 10)

const stableAppAssets = () => ({
  name: 'stable-app-assets',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const html = bundle['index.html']
    if (!html || html.type !== 'asset') return

    let source = String(html.source)
    for (const fileName of ['assets/app.js', 'assets/app.css']) {
      const output = bundle[fileName]
      if (!output) continue

      const contents = output.type === 'chunk' ? output.code : String(output.source)
      source = source.replaceAll(`/${fileName}`, `/${fileName}?v=${shortHash(contents)}`)
    }
    html.source = source
  },
})

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [react(), stableAppAssets()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const sourceName = assetInfo.names?.[0] || 'asset'
          return sourceName.endsWith('.css') ? 'assets/app.css' : 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
});
