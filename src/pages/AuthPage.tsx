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
        <DialogContent className="max-w-[500px] px-0 pb-10 pt-8" aria-describedby="auth-desc">
          <DialogTitle className="flex items-center justify-center gap-2 text-xl font-medium">
            <Link to="/login" search={{ redirect }} replace className={mode === 'login' ? 'text-brand-strong' : 'text-text hover:text-brand-strong'} aria-current={mode === 'login' ? 'page' : undefined}>
              Entrar
            </Link>
            <span className="h-5 w-px bg-brand" aria-hidden="true" />
            <Link to="/cadastro" search={{ redirect }} replace className={mode === 'register' ? 'text-brand-strong' : 'text-text hover:text-brand-strong'} aria-current={mode === 'register' ? 'page' : undefined}>
              Criar conta
            </Link>
          </DialogTitle>
          <DialogDescription id="auth-desc" className="mx-auto mt-7 max-w-[310px] text-center text-xs text-text">
            {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
          </DialogDescription>
          <div className="mx-auto mt-6 w-full max-w-[340px] px-4">{mode === 'login' ? <LoginForm /> : <RegisterForm />}</div>
          <div className="mt-6 flex items-center gap-3 text-sm" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            Ou continue com
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="mx-auto mt-4 grid w-full max-w-[340px] gap-3 px-4">
            {['Google', 'Facebook'].map((p) => (
              <Button key={p} variant="outline" className="border-line text-xs font-medium" onClick={() => toast.info(`Login com ${p} indisponível nesta demonstração. Use e-mail e senha.`)}>
                Continuar com {p}
              </Button>
            ))}
          </div>
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
        <Input type="email" autoComplete="email" placeholder="contato@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="login-password" label={<span className="sr-only">Senha</span>} error={errors.password}>
        <PasswordInput autoComplete="current-password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className="text-right">
        <button type="button" className="text-sm text-brand-strong hover:underline" onClick={() => toast.info('Recuperação de senha indisponível nesta demonstração.')}>
          Esqueceu a senha?
        </button>
      </div>
      <FormError message={serverError} />
      <Button type="submit" className="h-11 w-full text-base" disabled={login.isPending}>
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
        <Input autoComplete="username" placeholder="Nome de usuário" value={v.username} onChange={set('username')} />
      </Field>
      <Field id="reg-email" label={<span className="sr-only">E-mail</span>} error={errors.email}>
        <Input type="email" autoComplete="email" placeholder="Digite seu e-mail" value={v.email} onChange={set('email')} />
      </Field>
      <Field id="reg-password" label={<span className="sr-only">Senha</span>} error={errors.password} hint={<span className="sr-only">Mínimo de 8 caracteres.</span>}>
        <PasswordInput autoComplete="new-password" placeholder="Senha" value={v.password} onChange={set('password')} />
      </Field>
      <Field id="reg-confirmPassword" label={<span className="sr-only">Confirmar senha</span>} error={errors.confirmPassword}>
        <PasswordInput autoComplete="new-password" placeholder="Confirmar senha" value={v.confirmPassword} onChange={set('confirmPassword')} />
      </Field>
      <FormError message={serverError} />
      <Button type="submit" className="h-11 w-full text-base" disabled={register.isPending}>
        {register.isPending ? 'Criando conta…' : 'Criar conta'}
      </Button>
    </form>
  )
}
