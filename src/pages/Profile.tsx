import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageIcon } from 'lucide-react'
import type { PasswordBody, ProfileBody, User } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { qk } from '@/api/queryKeys'
import { sessionStore, useSession } from '@/lib/session'
import { announce } from '@/lib/announcer'
import { AccountLayout } from '@/components/AccountLayout'
import { Field, FormError } from '@/components/Field'
import { PasswordInput } from '@/components/PasswordInput'
import { ErrorState } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

export function ProfilePage() {
  const { scope } = useSession()
  const profile = useQuery({ queryKey: qk.profile(scope), queryFn: ({ signal }) => api.profile({ signal }), staleTime: 0 })

  useEffect(() => {
    document.title = 'Perfil do colecionador — Kurio'
  }, [])

  return (
    <AccountLayout title="Perfil do colecionador">
      {profile.isPending ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[66px] w-full" />
          ))}
        </div>
      ) : profile.isError ? (
        <div className="mt-6">
          <ErrorState message={profile.error.message} onRetry={() => void profile.refetch()} retrying={profile.isFetching} />
        </div>
      ) : (
        <>
          <ProfileForm user={profile.data} />
          <PasswordForm />
        </>
      )}
    </AccountLayout>
  )
}

function useApplyUser() {
  const qc = useQueryClient()
  const { scope } = useSession()
  return (u: User) => {
    qc.setQueryData(qk.profile(scope), u)
    sessionStore.updateUser(u)
  }
}

function ProfileForm({ user }: { user: User }) {
  const apply = useApplyUser()
  const [v, setV] = useState<ProfileBody>({ displayName: user.displayName, username: user.username, email: user.email, ensName: user.ensName ?? '', walletNickname: user.walletNickname ?? '' })
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileBody, string>>>({})
  const [saved, setSaved] = useState(false)
  const save = useMutation({
    mutationFn: (b: ProfileBody) => api.updateProfile(b),
    onSuccess: (u) => {
      apply(u)
      setSaved(true)
      announce('Perfil atualizado.')
    },
    onError: (e) => {
      if (isApiError(e) && e.fields) setErrors(e.fields)
      announce(isApiError(e) ? e.message : 'Não foi possível salvar.', 'assertive')
    },
  })

  const set = (k: keyof ProfileBody) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
    setSaved(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (v.displayName.trim().length < 2) next.displayName = 'Informe ao menos 2 caracteres.'
    if (!/^[a-z0-9._]{3,30}$/i.test(v.username.trim())) next.username = 'Use de 3 a 30 letras, números, ponto ou sublinhado.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) next.email = 'Informe um e-mail válido.'
    if (v.ensName && !/^[a-z0-9-]{3,32}$/i.test(v.ensName)) next.ensName = 'Use de 3 a 32 letras, números ou hífen.'
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) return document.getElementById(`pf-${first}`)?.focus()
    save.mutate(v)
  }

  const formError = save.isError && !(isApiError(save.error) && save.error.fields) ? save.error.message : null

  return (
    <form onSubmit={submit} noValidate className="mt-6" aria-label="Dados do perfil">
      <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2">
        <Field id="pf-displayName" label="Nome de exibição" required error={errors.displayName}>
          <Input value={v.displayName} onChange={set('displayName')} autoComplete="name" />
        </Field>
        <Field id="pf-username" label="Nome de usuário" required error={errors.username}>
          <Input value={v.username} onChange={set('username')} autoComplete="username" />
        </Field>
        <Field id="pf-email" label="E-mail" required error={errors.email}>
          <Input type="email" value={v.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <div>
          <label htmlFor="pf-ensName" className="mb-1.5 block text-sm">
            Nome ENS
          </label>
          <div className="flex gap-2">
            <span className="field-input w-auto shrink-0 text-muted" aria-hidden="true">
              .eth
            </span>
            <Input id="pf-ensName" value={v.ensName} onChange={set('ensName')} aria-invalid={!!errors.ensName || undefined} aria-describedby={errors.ensName ? 'pf-ensName-error' : undefined} />
          </div>
          {errors.ensName && (
            <p id="pf-ensName-error" className="mt-1 text-xs text-danger">
              ⚠ {errors.ensName}
            </p>
          )}
        </div>
        <Field id="pf-walletNickname" label="Apelido da carteira">
          <Input value={v.walletNickname} onChange={set('walletNickname')} />
        </Field>
        <AvatarField user={user} />
      </div>
      <div className="mt-6 space-y-3">
        <FormError message={formError} />
        {saved && (
          <p role="status" className="text-sm text-success">
            Perfil atualizado.
          </p>
        )}
        <Button type="submit" disabled={save.isPending} className="w-[98px]">
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

function AvatarField({ user }: { user: User }) {
  const apply = useApplyUser()
  const input = useRef<HTMLInputElement>(null)
  const upload = useMutation({
    mutationFn: (f: File) => api.uploadAvatar(f),
    onSuccess: (u) => {
      apply(u)
      announce('Avatar atualizado.')
    },
  })
  const remove = useMutation({
    mutationFn: () => api.removeAvatar(),
    onSuccess: (u) => {
      apply(u)
      announce('Avatar removido.')
    },
  })
  const error = upload.error ?? remove.error
  return (
    <div>
      <p className="mb-1.5 text-sm" id="avatar-label">
        Avatar
      </p>
      <div className="flex items-center gap-4">
        <span className="flex size-[50px] items-center justify-center overflow-hidden rounded-full bg-surface-2" data-testid="avatar-preview">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="Seu avatar" className="size-full object-cover" /> : <ImageIcon className="size-5 text-brand" aria-label="Sem avatar" />}
        </span>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id="avatar-file"
          aria-labelledby="avatar-label"
          aria-describedby="avatar-hint"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload.mutate(f)
            e.target.value = ''
          }}
        />
        <Button type="button" size="sm" className="h-10 px-5" onClick={() => input.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        {user.avatarUrl && (
          <Button type="button" size="sm" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
            Remover
          </Button>
        )}
      </div>
      <p id="avatar-hint" className="mt-1 text-xs text-muted">
        PNG, JPG ou WebP até 1 MB.
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {isApiError(error) ? error.message : 'Falha ao atualizar o avatar.'}
        </p>
      )}
    </div>
  )
}

function PasswordForm() {
  const [v, setV] = useState<PasswordBody>({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof PasswordBody, string>>>({})
  const change = useMutation({
    mutationFn: (b: PasswordBody) => api.changePassword(b),
    onSuccess: () => {
      setV({ currentPassword: '', newPassword: '', confirmPassword: '' })
      announce('Senha alterada com sucesso.')
    },
    onError: (e) => {
      if (isApiError(e) && e.fields) setErrors(e.fields)
    },
  })
  const set = (k: keyof PasswordBody) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!v.currentPassword) next.currentPassword = 'Informe a senha atual.'
    if (v.newPassword.length < 8) next.newPassword = 'A nova senha deve ter ao menos 8 caracteres.'
    if (v.newPassword !== v.confirmPassword) next.confirmPassword = 'As senhas não conferem.'
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) return document.getElementById(`pw-${first}`)?.focus()
    change.mutate(v)
  }
  return (
    <form onSubmit={submit} noValidate className="mt-10 max-w-[420px] space-y-4" aria-labelledby="pw-title">
      <h2 id="pw-title" className="text-lg font-bold">
        Alterar senha
      </h2>
      <Field id="pw-currentPassword" label="Senha atual" error={errors.currentPassword}>
        <PasswordInput autoComplete="current-password" value={v.currentPassword} onChange={set('currentPassword')} />
      </Field>
      <Field id="pw-newPassword" label="Nova senha" error={errors.newPassword} hint="Mínimo de 8 caracteres.">
        <PasswordInput autoComplete="new-password" value={v.newPassword} onChange={set('newPassword')} />
      </Field>
      <Field id="pw-confirmPassword" label="Confirmar nova senha" error={errors.confirmPassword}>
        <PasswordInput autoComplete="new-password" value={v.confirmPassword} onChange={set('confirmPassword')} />
      </Field>
      <FormError message={change.isError && !(isApiError(change.error) && change.error.fields) ? change.error.message : null} />
      {change.isSuccess && (
        <p role="status" className="text-sm text-success">
          Senha alterada com sucesso.
        </p>
      )}
      <Button type="submit" disabled={change.isPending}>
        {change.isPending ? 'Alterando…' : 'Alterar senha'}
      </Button>
    </form>
  )
}
