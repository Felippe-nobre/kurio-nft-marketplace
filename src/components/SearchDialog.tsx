import { useSyncExternalStore, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

/**
 * Diálogo "Buscar NFTs" compartilhado: aberto pelo botão de busca do cabeçalho
 * (desktop) ou pelo botão central da barra inferior (mobile, Figma). Guarda o
 * elemento que abriu o diálogo para devolver o foco a ele ao fechar.
 */
let state: { open: boolean; trigger: HTMLElement | null } = { open: false, trigger: null }
const listeners = new Set<() => void>()
const set = (next: typeof state) => {
  state = next
  listeners.forEach((l) => l())
}
export const openSearch = (trigger: HTMLElement | null) => set({ open: true, trigger })

export function SearchDialog() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => state,
  )
  const navigate = useNavigate()

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    set({ ...state, open: false })
    void navigate({ to: '/', search: { q: q || undefined }, hash: 'catalogo' })
  }

  return (
    <Dialog open={s.open} onOpenChange={(open) => set({ ...state, open })}>
      <DialogContent
        className="top-24 translate-y-0"
        // Sem DialogTrigger o Radix não sabe para onde devolver o foco: devolve a quem abriu.
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          state.trigger?.focus()
        }}
      >
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription className="mb-4">Busque por nome, criador ou coleção.</DialogDescription>
        <form onSubmit={submit} role="search" className="flex gap-2">
          <label htmlFor="header-search" className="sr-only">
            Termo de busca
          </label>
          <Input id="header-search" name="q" type="search" placeholder="Ex.: Emerald Ape" autoFocus />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
