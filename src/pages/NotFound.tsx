import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <section className="container-kurio py-24 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-3 text-muted">O endereço acessado não existe.</p>
      <Button asChild className="mt-6">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  )
}
