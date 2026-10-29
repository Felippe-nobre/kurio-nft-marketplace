import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { HomePage } from './Home'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/PasswordInput'
import { Field, FormError } from '@/components/Field'
import { useLogin, useRegister } from '@/hooks/useAuth'
import { isApiError } from '@/api/http'
import { sessionStore, useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

/** Ícones dos botões de login social (Figma). */
function ProviderIcon({ provider }: { provider: 'Google' | 'Facebook' }) {
  return provider === 'Google' ? (
    <svg viewBox="0 0 24 24" className="!size-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="!size-5" aria-hidden="true">
      <path fill="#3b5ba8" d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.3v3.2h2.8V22h3.4Z" />
    </svg>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function LoginPage() {
  return <AuthPage mode="login" />
}
export function RegisterPage() {
  return <AuthPage mode="register" />
}

function useAuthSearch() {
  return useSearch({ strict: false }) as { redirect?: string; reason?: 'expired' }
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { redirect } = useAuthSearch()
  const navigate = useNavigate()
  const { isAuthenticated } = useSession()

  useEffect(() => {
    document.title = mode === 'login' ? 'Entrar — Kurio' : 'Criar conta — Kurio'
  }, [mode])

  // Já autenticado: volta para o destino original.
  useEffect(() => {
    if (isAuthenticated) void navigate({ href: redirect ?? '/', replace: true })
  }, [isAuthenticated, navigate, redirect])

  const close = () => void navigate({ href: redirect && !/^\/(checkout|pedido|profile|wallets|favorites|activity)/.test(redirect) ? redirect : '/' })

  return (
    <>
      <div>
        <HomePage />
      </div>
      <Dialog open onOpenChange={(o) => !o && close()}>
        {/* Figma mobile: tela cheia com a marca, título, formulário e link de troca no rodapé. */}
        <DialogContent
          className="max-w-[500px] px-0 pb-10 pt-8 max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:border-0 max-md:bg-bg max-md:px-7 max-md:pb-8 max-md:pt-[132px] max-md:shadow-none"
          closeClassName="max-md:hidden"
          aria-describedby="auth-desc"
        >
          <p className="text-center text-[32px] font-bold leading-none tracking-[0.12em] md:hidden" aria-hidden="true">
            KURIO
          </p>
          <DialogTitle className="flex items-center justify-center gap-2 text-xl font-medium max-md:mt-[93px] max-md:font-bold">
            <span className="md:hidden">{mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</span>
            <Link to="/login" search={{ redirect }} replace className={cn('max-md:hidden', mode === 'login' ? 'text-brand-strong' : 'text-text hover:text-brand-strong')} aria-current={mode === 'login' ? 'page' : undefined}>
              Entrar
            </Link>
            <span className="h-5 w-px bg-brand max-md:hidden" aria-hidden="true" />
            <Link to="/cadastro" search={{ redirect }} replace className={cn('max-md:hidden', mode === 'register' ? 'text-brand-strong' : 'text-text hover:text-brand-strong')} aria-current={mode === 'register' ? 'page' : undefined}>
              Criar conta
            </Link>
          </DialogTitle>
          <DialogDescription id="auth-desc" className="mx-auto mt-7 max-w-[310px] text-center text-xs text-text max-md:sr-only">
            {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
          </DialogDescription>
          <div className="mx-auto mt-6 w-full max-w-[340px] px-4 max-md:mt-[27px] max-md:max-w-none max-md:px-0">{mode === 'login' ? <LoginForm /> : <RegisterForm />}</div>
          <div className="mt-6 flex items-center gap-3 text-sm max-md:mt-10 max-md:text-[13px]" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            Ou continue com
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="mx-auto mt-4 grid w-full max-w-[340px] gap-3 px-4 max-md:mt-3 max-md:max-w-none max-md:gap-4 max-md:px-0">
            {(['Google', 'Facebook'] as const).map((p) => (
              <Button key={p} variant="outline" className="border-line text-xs font-medium max-md:text-[13px] max-md:font-normal max-md:text-muted" onClick={() => toast.info(`Login com ${p} indisponível nesta demonstração. Use e-mail e senha.`)}>
                <ProviderIcon provider={p} />
                Continuar com {p}
              </Button>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-muted md:hidden">
            {mode === 'login' ? (
              <Link to="/cadastro" search={{ redirect }} replace className="hover:text-brand-strong">
                Novo na Kurio? Crie uma conta
              </Link>
            ) : (
              <Link to="/login" search={{ redirect }} replace className="hover:text-brand-strong">
                Já tem uma conta? Entre
              </Link>
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

function LoginForm() {
  const { redirect, reason } = useAuthSearch()
  const navigate = useNavigate()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [expired] = useState(() => reason === 'expired' || sessionStore.get().endedReason === 'expired')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!EMAIL_RE.test(email.trim())) next.email = 'Informe um e-mail válido.'
    if (!password) next.password = 'Informe sua senha.'
    setErrors(next)
    if (Object.keys(next).length) return document.getElementById(next.email ? 'login-email' : 'login-password')?.focus()
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          sessionStore.clearReason()
          void navigate({ href: redirect ?? '/', replace: true })
        },
      },
    )
  }

  const serverError = login.isError ? (isApiError(login.error) ? login.error.message : 'Não foi possível entrar.') : null
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {expired && !login.isSuccess && (
        <p role="status" className="border border-brand/60 bg-brand/10 p-2 text-xs">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}
      <Field id="login-email" label={<span className="sr-only">E-mail</span>} error={errors.email}>
        <Input type="email" autoComplete="email" placeholder="contato@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="max-md:h-[50px] max-md:rounded-lg max-md:px-4" />
      </Field>
      <Field id="login-password" label={<span className="sr-only">Senha</span>} error={errors.password}>
        <PasswordInput autoComplete="current-password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="max-md:h-[50px] max-md:rounded-lg max-md:px-4" />
      </Field>
      <div className="text-right">
        <button type="button" className="text-sm text-brand-strong hover:underline" onClick={() => toast.info('Recuperação de senha indisponível nesta demonstração.')}>
          Esqueceu a senha?
        </button>
      </div>
      <FormError message={serverError} />
      <Button type="submit" className="h-11 w-full text-base max-md:!mt-[25px] max-md:h-[60px] max-md:rounded-lg" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterForm() {
  const { redirect } = useAuthSearch()
  const navigate = useNavigate()
  const register = useRegister()
  const [v, setV] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof v, string>>>({})

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!/^[a-z0-9._]{3,30}$/i.test(v.username.trim())) next.username = 'Use de 3 a 30 caracteres: letras, números, ponto ou sublinhado.'
    if (!EMAIL_RE.test(v.email.trim())) next.email = 'Informe um e-mail válido.'
    if (v.password.length < 8) next.password = 'A senha deve ter ao menos 8 caracteres.'
    if (v.password !== v.confirmPassword) next.confirmPassword = 'As senhas não conferem.'
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) return document.getElementById(`reg-${first}`)?.focus()
    register.mutate(
      { ...v, username: v.username.trim(), email: v.email.trim() },
      {
        onSuccess: () => void navigate({ href: redirect ?? '/', replace: true }),
        onError: (err) => {
          if (isApiError(err) && err.fields) {
            setErrors(err.fields as typeof errors)
            document.getElementById(`reg-${Object.keys(err.fields)[0]}`)?.focus()
          }
        },
      },
    )
  }

  const serverError = register.isError && !(isApiError(register.error) && register.error.fields) ? register.error.message : null
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Field id="reg-username" label={<span className="sr-only">Nome de usuário</span>} error={errors.username}>
        <Input autoComplete="username" placeholder="Nome de usuário" value={v.username} onChange={set('username')} className="max-md:h-[50px] max-md:rounded-lg max-md:px-4" />
      </Field>
      <Field id="reg-email" label={<span className="sr-only">E-mail</span>} error={errors.email}>
        <Input type="email" autoComplete="email" placeholder="Digite seu e-mail" value={v.email} onChange={set('email')} className="max-md:h-[50px] max-md:rounded-lg max-md:px-4" />
      </Field>
      <Field id="reg-password" label={<span className="sr-only">Senha</span>} error={errors.password} hint={<span className="sr-only">Mínimo de 8 caracteres.</span>}>
        <PasswordInput autoComplete="new-password" placeholder="Senha" value={v.password} onChange={set('password')} className="max-md:h-[50px] max-md:rounded-lg max-md:px-4" />
      </Field>
      <Field id="reg-confirmPassword" label={<span className="sr-only">Confirmar senha</span>} error={errors.confirmPassword}>
        <PasswordInput autoComplete="new-password" placeholder="Confirmar senha" value={v.confirmPassword} onChange={set('confirmPassword')} className="max-md:h-[50px] max-md:rounded-lg max-md:px-4" />
      </Field>
      <FormError message={serverError} />
      <Button type="submit" className="h-11 w-full text-base max-md:!mt-[33px] max-md:h-[60px] max-md:rounded-lg" disabled={register.isPending}>
        {register.isPending ? (
          'Criando conta…'
        ) : (
          <>
            <span className="md:hidden">Criar perfil</span>
            <span className="max-md:hidden">Criar conta</span>
          </>
        )}
      </Button>
    </form>
  )
}
