import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * Com os mocks ligados (build de demonstração), o MSW precisa estar ativo antes da
 * primeira requisição. O chunk dele é carregado por import dinâmico em main.tsx, o que
 * só começa depois que o JS principal executa. Este plugin declara o chunk como
 * <link rel="modulepreload"> no HTML, para o download acontecer em paralelo.
 * Não muda comportamento: o mesmo código é carregado e executado na mesma ordem.
 */
function preloadMocks(enabled: boolean): Plugin {
  return {
    name: 'kurio-preload-mocks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!enabled || !ctx.bundle) return html
        const chunk = Object.values(ctx.bundle).find((c) => c.type === 'chunk' && c.facadeModuleId?.endsWith('/src/mocks/browser.ts'))
        if (!chunk) return html
        return { html, tags: [{ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/${chunk.fileName}` }, injectTo: 'head' }] }
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Mesma regra de main.tsx: mocks ligados, salvo VITE_ENABLE_MOCKS=false.
  const mocks = (process.env.VITE_ENABLE_MOCKS ?? env.VITE_ENABLE_MOCKS) !== 'false'
  return {
    plugins: [react(), tailwind(), preloadMocks(mocks)],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: {
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            tanstack: ['@tanstack/react-query', '@tanstack/react-router'],
          },
        },
      },
    },
    preview: { port: 4173, strictPort: true },
  }
})
