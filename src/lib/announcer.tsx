import { useEffect, useState } from 'react'

/** Região aria-live global para feedback de mutations e eventos em tempo real. */
type Msg = { id: number; text: string; politeness: 'polite' | 'assertive' }
const listeners = new Set<(m: Msg) => void>()
let seq = 0

export function announce(text: string, politeness: 'polite' | 'assertive' = 'polite') {
  const m = { id: ++seq, text, politeness }
  listeners.forEach((l) => l(m))
}

export function LiveAnnouncer() {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  useEffect(() => {
    const l = (m: Msg) => {
      const set = m.politeness === 'assertive' ? setAssertive : setPolite
      set('')
      // Limpa e reescreve para que leitores de tela anunciem mensagens repetidas.
      requestAnimationFrame(() => set(m.text))
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  )
}
