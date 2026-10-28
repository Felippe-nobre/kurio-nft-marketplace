import { useSyncExternalStore } from 'react'
import type { SessionResponse, User } from '@/api/contracts'

/**
 * Sessão do cliente: token opaco + usuário, persistidos em localStorage para
 * recuperação após refresh. A validade é conferida no servidor (GET /api/session);
 * a expiração local evita requisições com token sabidamente vencido.
 */
export interface SessionState {
  token: string | null
  expiresAt: string | null
  user: User | null
  /** Motivo do último encerramento (exibido na tela de login). */
  endedReason: 'expired' | 'logout' | null
}

const KEY = 'kurio:session'
const GUEST_KEY = 'kurio:guest-id'
const listeners = new Set<() => void>()

function read(): SessionState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as SessionState
      if (s.token && s.expiresAt && new Date(s.expiresAt).getTime() > Date.now()) return { ...s, endedReason: null }
      if (s.token) return { token: null, expiresAt: null, user: null, endedReason: 'expired' }
    }
  } catch {
    /* sessão corrompida */
  }
  return { token: null, expiresAt: null, user: null, endedReason: null }
}

let state: SessionState = read()

function set(next: SessionState) {
  state = next
  try {
    if (next.token) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    /* armazenamento indisponível */
  }
  listeners.forEach((l) => l())
}

export const sessionStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  start(s: SessionResponse) {
    set({ token: s.token, expiresAt: s.expiresAt, user: s.user, endedReason: null })
  },
  updateUser(user: User) {
    if (state.token) set({ ...state, user })
  },
  end(reason: 'expired' | 'logout') {
    if (!state.token && state.endedReason === reason) return
    set({ token: null, expiresAt: null, user: null, endedReason: reason })
  },
  clearReason() {
    if (state.endedReason) set({ ...state, endedReason: null })
  },
  isExpired: () => !!state.expiresAt && new Date(state.expiresAt).getTime() <= Date.now(),
  /** Escopo do cache privado: isola dados por usuário/visitante. */
  scope: () => (state.user ? `user:${state.user.id}` : `guest:${guestId()}`),
}

// Outras abas: mantém a sessão sincronizada.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = read()
      listeners.forEach((l) => l())
    }
  })
}

export function guestId() {
  try {
    let id = localStorage.getItem(GUEST_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(GUEST_KEY, id)
    }
    return id
  } catch {
    return 'guest-ephemeral-0000'
  }
}

export function useSession() {
  const s = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
  return { ...s, isAuthenticated: !!s.token && !!s.user, scope: s.user ? `user:${s.user.id}` : `guest:${guestId()}` }
}
