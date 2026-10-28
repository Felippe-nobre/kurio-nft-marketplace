import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Cart } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { qk } from '@/api/queryKeys'
import { useSession } from '@/lib/session'
import { announce } from '@/lib/announcer'
import { toast } from 'sonner'
import { mulEth } from '@/lib/money'

export function useCart() {
  const { scope } = useSession()
  return useQuery({ queryKey: qk.cart(scope), queryFn: ({ signal }) => api.cart({ signal }), staleTime: 5_000 })
}

const errMsg = (e: unknown) => (isApiError(e) ? e.message : 'Não foi possível atualizar o carrinho.')

export function useAddToCart() {
  const qc = useQueryClient()
  const { scope } = useSession()
  return useMutation({
    mutationFn: (v: { nftId: string; editionId: string; quantity: number; name?: string }) => api.setCartItem({ nftId: v.nftId, editionId: v.editionId, quantity: v.quantity, mode: 'add' }),
    onSuccess: (cart, v) => {
      qc.setQueryData(qk.cart(scope), cart)
      const msg = `${v.name ?? 'NFT'} adicionado ao carrinho.`
      toast.success(msg)
      announce(msg)
    },
    onError: (e) => {
      toast.error(errMsg(e))
      announce(errMsg(e), 'assertive')
    },
  })
}

/** Alteração de quantidade com atualização otimista e rollback em caso de falha. */
export function useSetQuantity() {
  const qc = useQueryClient()
  const { scope } = useSession()
  const key = qk.cart(scope)
  return useMutation({
    mutationFn: (v: { nftId: string; editionId: string; quantity: number }) =>
      v.quantity === 0 ? api.removeCartItem(v.nftId, v.editionId) : api.setCartItem({ ...v, mode: 'set' }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Cart>(key)
      if (previous) {
        const items = previous.items
          .map((l) => (l.nftId === v.nftId && l.editionId === v.editionId ? { ...l, quantity: v.quantity, lineTotal: mulEth(l.unitPrice, v.quantity) } : l))
          .filter((l) => l.quantity > 0)
        // Otimista: só quantidades/linhas; os totais monetários aguardam o servidor.
        qc.setQueryData<Cart>(key, { ...previous, items, count: items.reduce((a, l) => a + l.quantity, 0) })
      }
      return { previous }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
      toast.error(errMsg(e))
      announce(`${errMsg(e)} A alteração foi desfeita.`, 'assertive')
    },
    onSuccess: (cart, v) => {
      qc.setQueryData(key, cart)
      if (v.quantity === 0) announce('Item removido do carrinho.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useCoupon() {
  const qc = useQueryClient()
  const { scope } = useSession()
  const apply = useMutation({
    mutationFn: (code: string) => api.applyCoupon(code),
    onSuccess: (cart) => {
      qc.setQueryData(qk.cart(scope), cart)
      announce(`Cupom ${cart.coupon?.code} aplicado: ${cart.coupon?.percentOff}% de desconto.`)
    },
  })
  const remove = useMutation({
    mutationFn: () => api.removeCoupon(),
    onSuccess: (cart) => {
      qc.setQueryData(qk.cart(scope), cart)
      announce('Cupom removido.')
    },
  })
  return { apply, remove }
}
