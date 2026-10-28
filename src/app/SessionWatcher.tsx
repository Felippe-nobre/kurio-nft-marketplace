import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { sessionStore, useSession } from '@/lib/session'
import { announce } from '@/lib/announcer'
import { isPrivatePath } from './routes'

/**
 * Recupera e vigia a sessão:
 * - no boot, valida o token no servidor (GET /api/session);
 * - agenda a expiração local;
 * - quando a sessão termina (expiração/401/logout), limpa o cache privado e,
 *   se a página atual for privada, redireciona ao login preservando o retorno.
 */
export function SessionWatcher() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { token, expiresAt, user, endedReason } = useSession()
  const prevUser = useRef(user?.id ?? null)

  useEffect(() => {
    if (!token) return
    const ctrl = new AbortController()
    api
      .session({ signal: ctrl.signal })
      .then((s) => sessionStore.updateUser(s.user))
      .catch(() => {
        /* 401 já encerra a sessão no interceptor */
      })
    return () => ctrl.abort()
    // Apenas na troca de token (boot/login).
  }, [token])

  useEffect(() => {
    if (!expiresAt) return
    const ms = new Date(expiresAt).getTime() - Date.now()
    const t = setTimeout(() => sessionStore.end('expired'), Math.max(0, Math.min(ms, 2 ** 31 - 1)))
    return () => clearTimeout(t)
  }, [expiresAt])

  useEffect(() => {
    const prev = prevUser.current
    prevUser.current = user?.id ?? null
    if (prev && prev !== user?.id) qc.removeQueries({ queryKey: qk.privateScope(`user:${prev}`) })
    if (prev && !user && endedReason === 'expired') {
      toast.error('Sua sessão expirou. Entre novamente para continuar.')
      announce('Sua sessão expirou. Entre novamente para continuar.', 'assertive')
      if (isPrivatePath(pathname)) void navigate({ to: '/login', search: { redirect: href, reason: 'expired' } })
    }
  }, [user, endedReason, qc, navigate, href, pathname])

  return null
}
