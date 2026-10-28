import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LoginBody, RegisterBody, SessionResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { guestId, sessionStore } from '@/lib/session'
import { announce } from '@/lib/announcer'

/**
 * Após autenticar: mescla o carrinho do visitante no do usuário, só então
 * publica a sessão (a interface passa a mostrar "Minha conta") e descarta o
 * cache privado do visitante. Mesclar antes de publicar evita que uma
 * navegação imediata após o login aborte o merge e "perca" o carrinho, e que
 * um GET do carrinho vazio sobrescreva o resultado do merge.
 */
async function afterAuth(qc: ReturnType<typeof useQueryClient>, s: SessionResponse) {
  const guestScope = `guest:${guestId()}`
  let merged: Awaited<ReturnType<typeof api.mergeCart>> | null = null
  try {
    merged = await api.mergeCart(guestId(), s.token)
  } catch {
    // Falha no merge não impede o login; o carrinho do visitante continua no servidor.
  }
  if (merged) qc.setQueryData(qk.cart(`user:${s.user.id}`), merged)
  sessionStore.start(s)
  qc.removeQueries({ queryKey: qk.privateScope(guestScope) })
  announce(`Bem-vindo, ${s.user.displayName}.`)
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (b: LoginBody) => api.login(b), onSuccess: (s) => afterAuth(qc, s) })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (b: RegisterBody) => api.register(b), onSuccess: (s) => afterAuth(qc, s) })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await api.logout()
      } catch {
        /* sair localmente mesmo sem rede */
      }
    },
    onSettled: () => {
      sessionStore.end('logout')
      // Limpa TODO o cache privado (de qualquer escopo) e dados por usuário.
      qc.removeQueries({ queryKey: qk.privateAll })
      announce('Você saiu da sua conta.')
    },
  })
}
