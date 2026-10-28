# Arquitetura — Kurio NFT Marketplace

## Visão geral

```
React 18 + TypeScript (Vite)
├── TanStack Router ── rotas, search params validados, guarda de rotas privadas
├── TanStack Query ─── cache, mutations, invalidação, otimismo + rollback
├── Axios ──────────── único cliente REST (src/api/http.ts), erros normalizados
├── socket.io-client ─ tempo real (src/lib/realtime.tsx)
├── Tailwind CSS v4 + shadcn/ui (Radix) ── UI (src/components/ui)
└── MSW ────────────── "backend" da demo no navegador (src/mocks)
     ├── handlers REST  (http.*)
     └── servidor Socket.IO (ws.link + adaptador Engine.IO/Socket.IO próprio em src/mocks/realtime.ts)
```

Nenhuma resposta fictícia vive em componentes, hooks ou no cliente Axios: tudo passa por `src/api/endpoints.ts` → Axios → MSW. Os controles de cenário (`window.__kurio`, painel `?dev=1`) agem sobre o *servidor* simulado; a UI só muda pelo caminho normal (REST ou evento Socket.IO).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/api` | `contracts.ts` (tipos REST/eventos compartilhados), `http.ts` (Axios + `ApiError`), `endpoints.ts`, `queryKeys.ts` |
| `src/app` | rotas, layout raiz, `QueryClient`, `SessionWatcher` |
| `src/hooks` | hooks de dados (catálogo, carrinho, favoritos, autenticação) |
| `src/lib` | dinheiro em `BigInt`, sessão, tempo real, idempotência, anúncios `aria-live` |
| `src/components` | componentes de UI (shadcn/ui em `ui/`), layout, cards, formulários |
| `src/pages` | telas (Início, Detalhe, Carrinho, Pagamento, Pedido, Login/Cadastro, Perfil, Carteiras, Favoritos, Atividade) |
| `src/mocks` | banco simulado, fixtures, regras de negócio, handlers, servidor Socket.IO, cenários |
| `e2e` | Playwright (12 grupos + regressão visual) |
| `scripts/lighthouse.mjs` | auditoria Lighthouse (3 execuções, mediana) |

## Contratos REST

Base: `VITE_API_BASE_URL` (padrão `/api`). Erros: `{ code, message, fields?, details? }` com HTTP adequado.

| Método e rota | Descrição | Erros relevantes |
|---|---|---|
| `GET /highlights` | destaques do hero e "NFT em destaque" | |
| `GET /nfts?q&categories&networks&minPrice&maxPrice&sort&tab&page&pageSize` | catálogo paginado + facetas disjuntivas | |
| `GET /nfts/:id` · `/reviews` · `/related` | detalhe, avaliações, relacionados | 404 `NOT_FOUND` |
| `POST /auth/register` · `/auth/login` · `/auth/logout` | sessão (token opaco + `expiresAt`) | 409 `EMAIL_TAKEN`/`USERNAME_TAKEN`, 422, 401 `INVALID_CREDENTIALS` |
| `GET /session` | recupera a sessão após refresh | 401 `SESSION_EXPIRED` |
| `GET/PATCH /profile` · `POST/DELETE /profile/avatar` · `POST /profile/password` | perfil, avatar (multipart), senha | 409, 413, 415, 422 |
| `GET/POST /wallets` · `PATCH/DELETE /wallets/:id` | carteiras principal/secundárias | 409, 422 |
| `GET /favorites` · `PUT/DELETE /favorites/:id` | favoritos | 401 |
| `GET /cart` · `PUT /cart/items` · `DELETE /cart/items/:nftId/:editionId` | carrinho do visitante (`X-Guest-Id`) ou do usuário | 409 `OUT_OF_STOCK` |
| `PUT/DELETE /cart/coupon` · `POST /coupons/validate` | cupom | 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| `POST /cart/merge` | mescla o carrinho do visitante no login | |
| `POST /quotes` | cotação: preço, estoque, cupom, taxa de rede, total, `fingerprint` | |
| `POST/DELETE /wallet-connections` | conexão simulada da carteira | 403 `WALLET_REJECTED` |
| `POST /orders` (header `Idempotency-Key`) | cria pedido `pending` | 409 `QUOTE_CHANGED`/`OUT_OF_STOCK`/`QUOTE_EXPIRED`/`IDEMPOTENCY_CONFLICT` |
| `GET /orders` · `/orders/:id` · `/orders/:id/receipt` | estado e recibo | 404, 409 (recibo antes da confirmação) |
| `POST /newsletter` | inscrição | 422 |

**Dinheiro:** ETH sempre como string decimal (`"1.19"`). `src/lib/money.ts` converte para `BigInt` em wei (10⁻¹⁸) para somar, multiplicar por quantidade inteira e aplicar percentuais (pontos-base). Nenhuma conta monetária usa `number`. O slider de preço trabalha em centésimos inteiros.

## Eventos Socket.IO

Cliente: `io(origin, { path: '/socket.io', transports: ['websocket'], query: { token } })`.

```ts
interface RealtimeEvent { eventId: string; type: 'nft.updated' | 'order.updated'; resource: { type; id }; version: number; occurredAt: string; data }
```

| Evento | Quem recebe | `data` |
|---|---|---|
| `nft.updated` | todas as conexões | `price`, `available`, `editions[]`, `oldPrice` |
| `order.updated` | só as conexões do dono do pedido | `status`, `transactionId`, `declineReason`, `updatedAt` |

Regras do cliente (`EventGate`):
- **Duplicatas:** `eventId` já visto é ignorado.
- **Ordem:** só aplica `version` estritamente maior que a conhecida (do cache REST ou de eventos anteriores).
- **Estados terminais:** pedido `confirmed`/`declined` nunca volta para `pending`.
- **Aplicação:** os eventos atualizam o cache do TanStack Query (detalhe, listas, destaques, favoritos) e invalidam o carrinho, que é recalculado no servidor.
- **Reconexão:** backoff do `socket.io-client` (300 ms → 3 s). Ao reconectar, o cliente **reconcilia** invalidando catálogo, NFTs e todo o escopo privado; o checkout marca a cotação como desatualizada.
- **Isolamento:** a conexão é recriada quando o token muda (login, logout, troca de usuário); `removeAllListeners()` + `disconnect()` na limpeza.

### Transporte e limitações no ambiente de mocks

- O MSW intercepta o `WebSocket` criado pelo `socket.io-client` e um adaptador mínimo (`toSocketIo` em `src/mocks/realtime.ts`) fala o protocolo Engine.IO v4 / Socket.IO v5: handshake, CONNECT ao namespace `/`, heartbeat ping/pong (20 s) e pacotes EVENT. O `@mswjs/socket.io-binding@0.2.0` foi descartado porque não envia heartbeat (o cliente cai por *ping timeout*) nem responde ao CONNECT.
- O `ws.link` é a raiz `'/'`: a partir do MSW 2.15 o prefixo `/socket.io/` é removido do caminho antes do casamento, e RegExp não casa mais. Conexões que não são do Socket.IO (HMR do Vite em dev) seguem para o servidor real com `server.connect()`.
- O `socket.io-client` é importado sob demanda dentro do `RealtimeProvider`: o `engine.io-client` captura `globalThis.WebSocket` ao ser avaliado, e o MSW só o substitui em `worker.start()`. Não existe servidor Socket.IO real, então os eventos são gerados pelas regras do servidor simulado (alteração de preço/estoque, liquidação do pagamento).
- Só o transporte `websocket` é suportado (sem long-polling). Rooms e acks do servidor não são usados: o isolamento é feito filtrando as conexões pelo usuário do token.
- O "servidor" vive na mesma aba: duas abas têm servidores independentes, sincronizados apenas pelo `localStorage` no próximo carregamento. Eventos não atravessam abas.
- "Desconexão" é simulada derrubando os sockets pelo lado do servidor (`__kurio.socket.dropAll()`) ou recusando conexões e descartando eventos (`setBlackout(true)`), que é o cenário de perda de eventos.

## Sessão

- `POST /auth/login` devolve um token opaco e `expiresAt`. O token fica em `localStorage` (`kurio:session`) e vai no `Authorization: Bearer`.
- No boot, `GET /api/session` valida o token. Um 401 `SESSION_EXPIRED`/`UNAUTHORIZED` em qualquer chamada autenticada encerra a sessão (interceptor do Axios).
- Há também um timer local até `expiresAt`. Ao expirar, o `SessionWatcher` limpa o cache privado, avisa (toast + `aria-live`) e, em rota privada, redireciona para `/login?redirect=<rota>&reason=expired`.
- Rotas privadas (`/checkout`, `/pedido/:id`, `/profile`, `/wallets`, `/favorites`, `/activity`) usam `beforeLoad`. O parâmetro `redirect` só aceita caminhos internos.
- Senhas: PBKDF2-SHA256 (60 mil iterações) com salt por usuário via WebCrypto. Nada fica em texto claro. Trocar a senha invalida as outras sessões do usuário.

## Carrinho

- O carrinho é do servidor, identificado por `user:<id>` ou `guest:<uuid>` (`X-Guest-Id`, persistido no navegador). Sobrevive a refresh.
- No login: `POST /cart/merge` soma as quantidades do visitante às do usuário, limitadas ao estoque e ao máximo por linha (10). O cupom do visitante é preservado se o usuário não tiver um.
- A alteração de quantidade é **otimista com rollback**: atualiza linhas e contagem na hora e desfaz se o servidor recusar (ex.: acima do estoque). Os totais monetários sempre vêm do servidor.
- Quantidade máxima por linha = `min(10, disponível)`.

## Pedido, idempotência e consistência

1. O checkout pede uma **cotação** (`POST /quotes`), com preço, estoque, cupom e taxa de rede e um `fingerprint` do conteúdo.
2. A primeira cotação de cada combinação conta como revisada. Se um `nft.updated` atingir um item ou o socket reconectar, ela fica **desatualizada**: o botão de confirmar é bloqueado até o usuário **atualizar** e **aceitar** a nova cotação.
3. `POST /orders` leva `Idempotency-Key`. A chave é criada por tentativa a partir do hash do conteúdo e persistida (`kurio:checkout-attempt:<user>`), então refresh, clique duplo, retry ou timeout reutilizam a mesma chave.
   - Mesma chave e mesmo conteúdo: o servidor devolve o **mesmo pedido** (`Idempotent-Replayed: true`).
   - Mesma chave com conteúdo diferente: `409 IDEMPOTENCY_CONFLICT`.
4. Antes de criar o pedido, o servidor **revalida** preço, estoque, cupom e taxas. Divergência de fingerprint gera `409 QUOTE_CHANGED`, com a nova cotação em `details.quote`, e o cliente exige nova confirmação.
5. O pedido nasce `pending` e **reserva o estoque** (emitindo `nft.updated`). A liquidação simulada emite `order.updated`:
   - `confirmed`: remove do carrinho **só as quantidades compradas**.
   - `declined`: libera a reserva e mantém o carrinho.
6. A tela de confirmação só aparece com `status === 'confirmed'`. O **recibo** é um snapshot gravado na criação do pedido (linhas, preços unitários, cupom, taxa, total, carteira) e não muda se o catálogo mudar.
7. O pedido pendente é lembrado (`kurio:pending-order:<user>`). Depois de refresh ou reconexão, a página do pedido reconsulta o estado via REST e, sem tempo real, faz polling a cada 2 s.
8. Um retry automático da mutation só acontece para erros transitórios (rede, timeout, 5xx) e sempre com a mesma chave.

## Política de cache, retry, invalidação e sincronização

| Dado | Chave | `staleTime` | Invalidação/sincronização |
|---|---|---|---|
| Catálogo | `['catalog', query]` | 30 s | eventos `nft.updated` (patch); reconexão; `keepPreviousData` na troca de filtros |
| Detalhe | `['nft', id]` | 30 s | eventos (patch por versão); REST antigo não sobrescreve versão mais nova |
| Destaques/relacionados | `['highlights']`, `['nft', id, 'related']` | 30 s | eventos (patch) |
| Carrinho | `['private', scope, 'cart']` | 5 s | mutations (`setQueryData`), eventos de NFT/pedido, merge no login |
| Favoritos | `['private', scope, 'favorites']` | 10 s | mutation otimista + `invalidate` no `onSettled` |
| Perfil/carteiras/pedidos | `['private', scope, …]` | 0 s | mutations e eventos `order.updated` |
| Cotação | `['private', scope, 'quote', rede, cupom, hashItens]` | ∞ | atualização explícita (evento/reconexão marcam como desatualizada) |

- `scope` = `user:<id>` ou `guest:<uuid>`. Assim o cache privado fica isolado por usuário. No logout, `removeQueries(['private'])` apaga tudo. Na troca de usuário, o escopo anterior é removido.
- **Retry:** consultas repetem até 2 vezes, com backoff exponencial, só em erros transitórios (rede, timeout, 5xx). Erros 4xx nunca se repetem. Mutations não repetem, exceto a criação de pedido, que é idempotente.
- **Respostas obsoletas/fora de ordem:** o `AbortSignal` do TanStack Query é repassado ao Axios, e cada combinação de filtros tem chave própria. Uma resposta atrasada de uma chave antiga nunca substitui a atual.
- `refetchOnWindowFocus` e `refetchOnReconnect` ficam ativos.

## Cenários da API simulada

Persistidos em `localStorage` (`kurio:scenario`), controlados pelo painel (`?dev=1`) ou por `window.__kurio.scenario.set({...})`:

`latency` (`none`/`fast`/`realistic`/`slow`), `failures` por rota (`network`, `timeout`, `empty`, `400`–`503`, com `times`), `outOfOrder`, `payment` (`confirm`/`decline`/`manual`), `paymentDelayMs`, `walletConnect` (`approve`/`reject`), `orderTimeoutAfterCreate`, `priceChangeOnConfirm`, `soldOutOnConfirm`, `sessionTtlMs`, `clientTimeoutMs`.

Ações de servidor: `updateEdition(id, edition, { price, available })`, `settleOrder(id, status)`, `expireSessions()`, `socket.dropAll()`, `socket.setBlackout(bool)`, `socket.replay()`, `socket.emitRaw(evt)` e `reset()`.

Dados determinísticos: PRNG com seed fixa gera 36 NFTs (9 do Figma e 27 complementares), 9 coleções, 3 redes, 4 edições por NFT e uma peça esgotada (`/nft/14`).

## Decisões de UX

- O layout segue as telas do Figma (`Frontend Challenge`): paleta, Roboto Mono, grade de 1200 px, cards, resumo do carrinho, pagamento em duas colunas e confirmação em modal.
- Login e Cadastro são diálogos sobre a página inicial, como no Figma, mas com rotas próprias (`/login`, `/cadastro`) para deep-link e retorno.
- O Figma não traz campo de busca no catálogo, mas o requisito pede. Foi adicionado um campo discreto acima da grade, além da lupa do cabeçalho.
- Filtros viram drawer (Sheet) abaixo de 1024 px. O menu principal vira drawer abaixo de 768 px.
- Os skeletons têm as mesmas dimensões do conteúdo final, para evitar CLS. O shimmer é desligado com `prefers-reduced-motion`.
- Feedback acessível: região `aria-live` global para mutations e eventos em tempo real, toasts visuais e erros associados aos campos (`aria-invalid` + `aria-describedby`), com foco no primeiro campo inválido.
- O status nunca é comunicado só por cor: há textos ("Esgotado", "Principal", "Pendente") e ícones.
- Itens do Figma sem backend na proposta (login social, recuperação de senha, "Ofertas", "Arquivos baixados", "Suporte", redes sociais) aparecem desabilitados ou com aviso explícito de indisponibilidade. Nenhum deles simula sucesso.
- "Código de indicação" aparece como obrigatório no Figma, mas foi tratado como opcional, porque não há regra de negócio associada.
- "Ver no Etherscan" informa que a transação é simulada em vez de abrir um link inexistente.
