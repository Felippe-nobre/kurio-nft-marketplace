import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Wrench } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { FailureKind, Scenario } from '@/mocks/scenario'

/**
 * Painel de cenários da API simulada (abre com ?dev=1). Todas as ações agem
 * sobre o "servidor" MSW; a interface só muda via REST/Socket.IO.
 */
export default function DevPanel() {
  const ctl = window.__kurio
  const qc = useQueryClient()
  const [s, setS] = useState<Scenario | null>(() => ctl?.scenario.get() ?? null)
  const [route, setRoute] = useState('GET /api/nfts')
  const [kind, setKind] = useState<FailureKind>('500')
  const [nftId, setNftId] = useState('1')
  const [price, setPrice] = useState('1.49')
  if (!ctl || !s) return null
  const patch = (p: Partial<Scenario>) => setS(ctl.scenario.set(p))

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" className="fixed bottom-4 left-4 z-40 rounded-full shadow-lg" aria-label="Abrir painel de cenários">
          <Wrench aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(26rem,92vw)] text-sm">
        <SheetTitle className="text-lg font-bold">Cenários da API simulada</SheetTitle>
        <SheetDescription className="text-muted">MSW + Socket.IO. As mudanças persistem no navegador.</SheetDescription>

        <label className="block">
          Latência
          <select className="field-input mt-1" value={s.latency} onChange={(e) => patch({ latency: e.target.value as Scenario['latency'] })}>
            <option value="none">Nenhuma</option>
            <option value="fast">Rápida</option>
            <option value="realistic">Variável (150–600 ms)</option>
            <option value="slow">Lenta (1,5–2,5 s)</option>
          </select>
        </label>
        <label className="block">
          Pagamento
          <select className="field-input mt-1" value={s.payment} onChange={(e) => patch({ payment: e.target.value as Scenario['payment'] })}>
            <option value="confirm">Confirmar</option>
            <option value="decline">Recusar</option>
            <option value="manual">Manual (fica pendente)</option>
          </select>
        </label>
        <label className="block">
          Conexão de carteira
          <select className="field-input mt-1" value={s.walletConnect} onChange={(e) => patch({ walletConnect: e.target.value as Scenario['walletConnect'] })}>
            <option value="approve">Aprovar</option>
            <option value="reject">Recusar</option>
          </select>
        </label>
        {(
          [
            ['outOfOrder', 'Catálogo com respostas fora de ordem'],
            ['priceChangeOnConfirm', 'Preço muda na confirmação (1x)'],
            ['soldOutOnConfirm', 'Edição esgota na confirmação (1x)'],
            ['orderTimeoutAfterCreate', 'Timeout após criar pedido (1x)'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" checked={s[k]} onChange={(e) => patch({ [k]: e.target.checked })} />
            {label}
          </label>
        ))}

        <fieldset className="space-y-2 border border-line p-3">
          <legend className="px-1 font-bold">Falha por rota</legend>
          <input className="field-input" value={route} onChange={(e) => setRoute(e.target.value)} aria-label="Rota (ex.: GET /api/nfts)" />
          <select className="field-input" value={kind} onChange={(e) => setKind(e.target.value as FailureKind)} aria-label="Tipo de falha">
            {['network', 'timeout', 'empty', '400', '401', '403', '404', '409', '422', '500', '503'].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => patch({ failures: { ...s.failures, [route]: { kind } } })}>
              Ativar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => patch({ failures: {} })}>
              Limpar falhas
            </Button>
          </div>
          <p className="text-xs text-muted">Ativas: {Object.keys(s.failures).join(', ') || 'nenhuma'}</p>
        </fieldset>

        <fieldset className="space-y-2 border border-line p-3">
          <legend className="px-1 font-bold">Tempo real</legend>
          <div className="flex gap-2">
            <input className="field-input" value={nftId} onChange={(e) => setNftId(e.target.value)} aria-label="ID do NFT" />
            <input className="field-input" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Novo preço (ETH)" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => ctl.updateEdition(nftId, '1-50', { price })}>
              Alterar preço (1/50)
            </Button>
            <Button size="sm" onClick={() => ctl.updateEdition(nftId, '1-50', { available: 0 })}>
              Esgotar 1/50
            </Button>
            <Button size="sm" variant="outline" onClick={() => ctl.socket.dropAll()}>
              Derrubar sockets
            </Button>
            <Button size="sm" variant="outline" onClick={() => ctl.socket.replay()}>
              Reenviar último evento
            </Button>
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => ctl.expireSessions()}>
            Expirar sessões
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              ctl.reset()
              qc.clear()
              localStorage.removeItem('kurio:session')
              location.reload()
            }}
          >
            Resetar cenário
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
