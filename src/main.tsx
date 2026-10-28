import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/500.css'
import '@fontsource/roboto-mono/700.css'
import './index.css'
import { createQueryClient } from './app/queryClient'
import { createAppRouter } from './app/routes'
import { RealtimeProvider } from './lib/realtime'

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

async function boot() {
  // O MSW é a "API" da demonstração; liga por configuração (VITE_ENABLE_MOCKS).
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          <RouterProvider router={router} />
        </RealtimeProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void boot()
