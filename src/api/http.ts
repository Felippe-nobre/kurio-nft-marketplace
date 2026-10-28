import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from './contracts'
import { guestId, sessionStore } from '@/lib/session'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
const defaultTimeout = Number(import.meta.env.VITE_HTTP_TIMEOUT_MS || 8000)

/** Erro normalizado de toda chamada REST. */
export class ApiError extends Error {
  status: number
  code: ApiErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED'
  fields?: Record<string, string>
  details?: unknown
  constructor(init: { status: number; code: ApiError['code']; message: string; fields?: Record<string, string>; details?: unknown }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fields = init.fields
    this.details = init.details
  }
  get isTransient() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.status >= 500
  }
}

export const http = axios.create({ baseURL, timeout: defaultTimeout, headers: { Accept: 'application/json' } })

http.interceptors.request.use((config) => {
  // Com mocks ativos, o timeout pode ser ajustado pelo cenário (testes de timeout).
  const mockTimeout = typeof window !== 'undefined' ? window.__kurio?.scenario.get().clientTimeoutMs : undefined
  if (mockTimeout && config.timeout === defaultTimeout) config.timeout = mockTimeout
  const { token } = sessionStore.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Guest-Id', guestId())
  return config
})

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(error)) return Promise.reject(new ApiError({ status: 0, code: 'CANCELED', message: 'Requisição cancelada.' }))
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
      return Promise.reject(new ApiError({ status: 0, code: 'TIMEOUT', message: 'O servidor demorou para responder. Tente novamente.' }))
    if (!error.response) return Promise.reject(new ApiError({ status: 0, code: 'NETWORK', message: 'Falha de conexão. Verifique sua internet e tente novamente.' }))
    const { status, data } = error.response
    const apiErr = new ApiError({
      status,
      code: data?.code ?? 'INTERNAL',
      message: data?.message ?? 'Erro inesperado. Tente novamente.',
      fields: data?.fields,
      details: data?.details,
    })
    const sentToken = !!(error.config?.headers as Record<string, unknown> | undefined)?.Authorization
    if (status === 401 && sentToken && (apiErr.code === 'SESSION_EXPIRED' || apiErr.code === 'UNAUTHORIZED')) sessionStore.end('expired')
    return Promise.reject(apiErr)
  },
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const r = await http.request<T>(config)
  return r.data
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError
