import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const shortAddress = (value: string, head = 6, tail = 4) => (value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value)

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(iso)).replace('.', '')

/** React 18 não reconhece fetchPriority; usa o atributo HTML em minúsculas. */
export const fetchPriority = (high: boolean) => ({ fetchpriority: high ? 'high' : 'auto' }) as Record<string, string>
