import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import { SearchDialog } from '@/components/SearchDialog'
import { Footer } from '@/components/layout/Footer'
import { Toaster } from '@/components/ui/sonner'
import { LiveAnnouncer } from '@/lib/announcer'
import { SessionWatcher } from './SessionWatcher'
import { cn } from '@/lib/utils'

const DevPanel = lazy(() => import('@/components/DevPanel'))

export function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [showDev, setShowDev] = useState(false)
  // Figma mobile: a barra de navegação inferior aparece no Início.
  const showMobileNav = pathname === '/'

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get('dev')
    if (flag === '1') localStorage.setItem('kurio:dev', '1')
    if (flag === '0') localStorage.removeItem('kurio:dev')
    setShowDev(import.meta.env.VITE_SHOW_DEVTOOLS === 'true' || localStorage.getItem('kurio:dev') === '1')
  }, [])

  // Move o foco para o conteúdo principal ao trocar de página (leitores de tela).
  // No carregamento inicial não move: o primeiro Tab deve chegar ao link "Pular para o conteúdo".
  const lastPath = useRef(pathname)
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    const main = document.getElementById('conteudo')
    if (main && document.activeElement === document.body) main.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className={cn('flex min-h-dvh flex-col', showMobileNav && 'max-md:pb-24')}>
      <a href="#conteudo" className="sr-only z-[60] bg-brand px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <Footer />
      {showMobileNav && <MobileNav />}
      <SearchDialog />
      <Toaster />
      <LiveAnnouncer />
      <SessionWatcher />
      {showDev && (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      )}
    </div>
  )
}
