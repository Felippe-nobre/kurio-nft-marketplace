import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react'
import { request, isApiError } from '@/api/http'
import { announce } from '@/lib/announcer'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const COLUMNS: { title: string; links: { label: string; to?: '/profile' | '/activity' | '/favorites' | '/wallets'; cat?: string }[] }[] = [
  {
    title: 'Meu perfil',
    links: [{ label: 'Meu perfil', to: '/profile' }, { label: 'Minha coleção', to: '/activity' }, { label: 'Atividade', to: '/activity' }, { label: 'Estúdio do criador' }, { label: 'Lista de interesse', to: '/favorites' }],
  },
  {
    title: 'Central de ajuda',
    links: [{ label: 'Central de ajuda' }, { label: 'Como comprar NFTs' }, { label: 'Carteira e segurança', to: '/wallets' }, { label: 'Política do mercado' }, { label: 'Denunciar item' }],
  },
  {
    title: 'Coleções',
    links: ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'].map((c) => ({ label: c, cat: c })),
  },
]

export function Footer() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const subscribe = useMutation({
    mutationFn: (value: string) => request<{ ok: true }>({ url: '/newsletter', method: 'POST', data: { email: value } }),
    onSuccess: () => {
      setEmail('')
      announce('Inscrição confirmada. Você receberá os próximos lançamentos.')
    },
    onError: (e) => setError(isApiError(e) ? e.message : 'Não foi possível inscrever agora.'),
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError('Informe um e-mail válido.')
    subscribe.mutate(email)
  }

  return (
    <footer className="container-kurio mt-20" id="criadores">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 bg-surface px-6 py-8 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.3fr] lg:px-12">
        {FEATURES.map((f) => (
          <div key={f.letter} className="lg:border-r lg:border-brand lg:pr-6">
            <span aria-hidden="true" className="flex size-[74px] items-center justify-center rounded-full bg-brand text-2xl font-bold text-primary-foreground">
              {f.letter}
            </span>
            <h2 className="mt-5 text-lg font-bold">{f.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{f.text}</p>
          </div>
        ))}
        <div>
          <h2 className="text-lg font-bold leading-tight">Antecipe-se ao próximo lançamento</h2>
          <form onSubmit={submit} className="mt-4 flex" noValidate>
            <label htmlFor="newsletter-email" className="sr-only">
              Seu e-mail
            </label>
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="digite seu e-mail..."
              aria-invalid={!!error || undefined}
              aria-describedby={error ? 'newsletter-error' : 'newsletter-hint'}
              className="h-10 min-w-0 flex-1 bg-surface-2 px-3 text-sm placeholder:text-muted focus-visible:outline-2"
            />
            <button type="submit" className="h-10 bg-brand px-4 text-lg font-bold text-primary-foreground disabled:opacity-60" disabled={subscribe.isPending}>
              {subscribe.isPending ? '…' : 'Enviar'}
            </button>
          </form>
          {error ? (
            <p id="newsletter-error" role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          ) : subscribe.isSuccess ? (
            <p role="status" className="mt-2 text-xs text-success">
              Inscrição confirmada!
            </p>
          ) : null}
          <p id="newsletter-hint" className="mt-4 text-sm leading-relaxed text-muted">
            Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
          </p>
        </div>
      </div>

      <div className="grid gap-3 bg-surface-2 px-6 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <span className="font-bold tracking-[0.18em]">KURIO</span>
        <span>Feito para colecionadores, criadores e cultura</span>
        <a href="mailto:contato@email.com" className="hover:text-brand-strong">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:text-brand-strong">
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid gap-8 bg-surface px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-lg font-bold">{col.title}</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.cat ? (
                    <Link to="/" search={{ cat: l.cat }} hash="catalogo" className="hover:text-brand-strong">
                      {l.label}
                    </Link>
                  ) : l.to ? (
                    <Link to={l.to} className="hover:text-brand-strong">
                      {l.label}
                    </Link>
                  ) : (
                    <span className="text-subtle" title="Em breve">
                      {l.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div>
          <h2 className="text-lg font-bold">Redes sociais</h2>
          <ul className="mt-3 flex gap-2">
            {[
              { Icon: Facebook, label: 'Facebook' },
              { Icon: Instagram, label: 'Instagram' },
              { Icon: Twitter, label: 'Twitter' },
              { Icon: Linkedin, label: 'LinkedIn' },
              { Icon: Youtube, label: 'YouTube' },
            ].map(({ Icon, label }) => (
              <li key={label}>
                <span role="img" aria-label={`${label} (em breve)`} className="flex size-8 items-center justify-center rounded-[3px] border border-brand text-brand">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </li>
            ))}
          </ul>
          <h2 className="mt-6 text-lg font-bold">Carteiras compatíveis</h2>
          <WalletStrip className="mt-3" />
        </div>
      </div>
      <p className="py-6 text-center text-sm">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

export function WalletStrip({ className }: { className?: string }) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-[3px] border border-line bg-surface-2 px-2.5 py-1.5 text-[9px] font-bold tracking-wider text-brand-strong ${className ?? ''}`}>
      METAMASK <span aria-hidden="true">•</span> WALLETCONNECT <span aria-hidden="true">•</span> COINBASE
    </p>
  )
}
