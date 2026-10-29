# Kurio — NFT Marketplace

Marketplace de NFTs (desafio frontend) em **React + TypeScript**, com **TanStack Router**, **TanStack Query**, **Axios**, **Socket.IO** (`socket.io-client`), **Tailwind CSS v4 + shadcn/ui**, **MSW** (API REST e Socket.IO simulados), **Playwright** e **Lighthouse**.

O layout segue as telas do Figma do desafio (Início, Detalhes do NFT, Carrinho, Pagamento, Confirmação, Login, Cadastro, Perfil e Carteiras), em desktop e mobile, com as artes oficiais exportadas (`public/img/nft/*.png` → `public/img/art/*.webp`).

> Não há backend nem blockchain reais. O MSW roda a "API" e o servidor Socket.IO dentro do navegador, a autenticação é simulada (senhas guardadas só como hash PBKDF2) e as transações são fictícias. Use apenas as credenciais de demonstração.

## Requisitos

- **Node.js 22.19 ou superior** e npm 10 ou superior (o Lighthouse 13 exige Node ≥ 22.19).
- Para os testes E2E: `npx playwright install chromium` (uma vez). O `@playwright/test` está fixado em `1.63.0`, versão cujo Chromium estava disponível no ambiente onde os testes foram executados; pode ser atualizado normalmente.

## Começando

```bash
npm ci            # instala as dependências exatas do package-lock.json (gera public/mockServiceWorker.js)
npm run dev       # http://localhost:5173, com os mocks ligados
```

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento com mocks (MSW) |
| `npm run build` | build de produção (`tsc -b` + Vite) |
| `npm run build:demo` | build de demonstração (`--mode demo`, lê `.env.demo` com `VITE_ENABLE_MOCKS=true`); é o que vai para o deploy |
| `npm run preview` | serve `dist/` em http://localhost:4173 |
| `npm run typecheck` | verificação de tipos |
| `npm run lint` | ESLint (TypeScript + regras de hooks) |
| `npm run test:e2e` | Playwright (sobe build demo + preview sozinho) |
| `npm run test:e2e:update` | regrava as baselines de regressão visual |
| `npm run test:e2e:report` | abre o relatório HTML do Playwright |
| `npm run lighthouse` | Lighthouse em Início e Detalhe, mobile e desktop, 3 execuções cada (requer `build:demo`) |
| `npm run check:routes` | acesso direto + refresh de todas as rotas em 390, 768 e 1440 px (requer `preview` ativo; aceita `BASE_URL`) |
| `npm run check` | typecheck + lint + build demo + E2E |

## Variáveis de ambiente

Copie `.env.example` para `.env.local` se quiser alterar algo. Nenhuma variável é secreta.

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (REST + Socket.IO). Com `false`, o app chama a API real em `VITE_API_BASE_URL` e o código dos mocks nem entra no build. |
| `VITE_API_BASE_URL` | `/api` | Base do Axios |
| `VITE_SOCKET_URL` | origem da página | Servidor Socket.IO |
| `VITE_HTTP_TIMEOUT_MS` | `8000` | Timeout do Axios |
| `VITE_SHOW_DEVTOOLS` | `false` | Mostra sempre o painel de cenários |

## Credenciais fictícias

| Usuário | E-mail | Senha | Observações |
|---|---|---|---|
| Ana Kurio | `ana@kurio.test` | `senha123` | carteira principal MetaMask/Ethereum ("Cofre principal"), 1 favorito |
| Bruno Lima | `bruno@kurio.test` | `senha123` | sem carteiras |

Cupons: `KURIO10` (10%), `LANCAMENTO5` (5%), `VERAO2025` (expirado). Qualquer outro código é inválido.

Dados prontos: `/nft/14` tem a edição padrão esgotada; `/nft/inexistente` mostra a tela de NFT inexistente; qualquer rota desconhecida mostra "Página não encontrada".

## Cenários e reset

Abra qualquer página com **`?dev=1`** para ver o botão 🔧 (canto inferior esquerdo) com o **painel de cenários**. Para escondê-lo, use `?dev=0`. No painel dá para:

- definir a latência (nenhuma, rápida, variável 150–600 ms, lenta) e respostas **fora de ordem** no catálogo;
- injetar falhas por rota (`GET /api/nfts`, `POST /api/orders`…): falha de conexão, **timeout**, vazio, 400/401/403/404/409/422/500/503;
- definir o pagamento como **confirmado**, **recusado** ou **manual** (fica pendente) e a conexão da carteira como aprovada ou **recusada**;
- ativar cenários de uso único: **preço alterado** ou **edição esgotada** no momento da confirmação, **timeout após criar o pedido**;
- em tempo real: alterar preço/estoque (emite `nft.updated`), **derrubar os sockets**, **reenviar o último evento** (duplicata);
- **expirar as sessões**;
- **resetar o cenário**: restaura o banco determinístico e limpa a sessão.

O cenário padrão (sem alterações) é latência variável de 150 a 600 ms, pagamento confirmado após um pequeno atraso e carteira aprovada.

Também pelo console: `window.__kurio.reset()`, `window.__kurio.scenario.set({ payment: 'decline' })`, `window.__kurio.updateEdition('1', '1-50', { price: '1.50' })`, `window.__kurio.socket.setBlackout(true)` etc. A referência completa está em [ARCHITECTURE.md](./ARCHITECTURE.md#cenários-da-api-simulada).

### Como reproduzir os fluxos de falha

Todos pelo painel `?dev=1` (ou pelo console). Entre como `ana@kurio.test` quando o fluxo exigir sessão.

| Fluxo | Como reproduzir | O que observar |
|---|---|---|
| Carregamento lento e skeletons | Latência "lenta" e recarregue o Início ou um NFT | skeletons com shimmer, sem deslocamento de layout |
| Respostas fora de ordem | Ative "fora de ordem" e troque filtros rapidamente | o catálogo mostra sempre a busca mais recente |
| Falha de API e nova tentativa | Em "Falha por rota", rota `GET /api/nfts`, tipo `500` (ou `network`/`timeout`), "Ativar"; recarregue. Depois "Limpar falhas" e clique em "Tentar novamente" | mensagem de erro com "Tentar novamente", que recupera |
| Resultado vazio | Falha `empty` em `GET /api/nfts` | "Nenhum NFT encontrado." com ação para limpar os filtros |
| Sessão expirada | "Expirar sessões" com uma página privada aberta (ex.: checkout) e faça uma ação | aviso, ida ao login e retorno à mesma página após entrar |
| Cadastro com conflito | Cadastre `ana@kurio.test` | erro de e-mail já usado, associado ao campo |
| Cupom inválido/expirado | Aplique `XYZ` ou `VERAO2025` no carrinho | mensagem específica, carrinho inalterado |
| Preço ou estoque muda no carrinho | Com o carrinho aberto, informe o ID do NFT e use "Alterar preço (1/50)" ou "Esgotar 1/50" | aviso no carrinho e resumo atualizado |
| Preço muda durante o checkout | Na revisão do pagamento, use "Alterar preço (1/50)" | cotação desatualizada, confirmação bloqueada até aceitar a nova |
| Preço/esgotado na confirmação | Ative "preço alterado" ou "edição esgotada" e confirme | nova confirmação exigida ou finalização bloqueada |
| Carteira recusada / desconexão | Conexão "recusada" e clique em "Conectar"; depois aprove e use "Desconectar" | motivo da recusa; volta ao estado sem carteira |
| Pagamento recusado | Pagamento "recusado" e finalize | pedido recusado, carrinho preservado |
| Clique repetido | Clique duas vezes em "Confirmar compra" | um único pedido |
| Timeout após criar o pedido | Ative "timeout após criar o pedido" e confirme; depois "Tentar novamente" | o mesmo pedido é recuperado (idempotência), sem duplicar |
| Desconexão com pedido pendente | Pagamento "Manual (fica pendente)"; finalize; "Derrubar sockets" ou recarregue a página. Para liquidar: `__kurio.settleOrder(__kurio.orders().at(-1).id, 'confirmed')` no console | o pedido pendente é retomado sem duplicar; ao liquidar, aparece a confirmação |
| Eventos duplicados | "Reenviar último evento" | nada é reaplicado nem regride |

## Testes E2E (Playwright)

```bash
npx playwright install chromium
npm run test:e2e
```

- Projetos: `desktop-chromium` (1440×900, todos os testes) e `mobile-chromium` (390×844, fluxos principais com a tag `@mobile` e a regressão visual).
- Cobrem os 12 grupos do desafio (`e2e/01…12-*.spec.ts`), um grupo complementar (`e2e/13-briefing-gaps.spec.ts`: recusa e desconexão de carteira, expiração durante o checkout, reflow em 320 px) e a regressão visual de Início, Detalhe, Carrinho e Pagamento (`e2e/visual.spec.ts`; as baselines ficam versionadas em `e2e/__screenshots__/`).
- Cada teste parte de um contexto novo, com `localStorage` e Service Worker isolados. O cenário inicial é determinístico (latência zero, seed fixa, relógio fixo nos testes visuais). Os testes controlam o "servidor" via `window.__kurio` e disparam os eventos de tempo real por ele.
- Os testes REST passam pelos handlers do MSW e os de tempo real pelo `socket.io-client`.
- Relatório HTML em `playwright-report/` (o da última execução acompanha a entrega). Traces e screenshots são gravados em `test-results/` **somente quando um teste falha** (`trace: 'retain-on-failure'`).

As baselines visuais dependem da renderização de fontes do sistema operacional. Em uma máquina diferente da que as gerou (Linux), rode `npm run test:e2e:update` uma vez antes de usá-las como referência.

## Lighthouse

```bash
npm run build:demo
npm run lighthouse
```

Gera 3 relatórios (HTML e JSON) por página e perfil em `lighthouse/reports/`, e as medianas em `lighthouse/RESULTS.md` e `lighthouse/summary.json` (com LCP, CLS, TBT, versões, ambiente e condições). Usa o Chromium do Playwright, ou `CHROME_PATH` se definido. A configuração da auditoria é o próprio `scripts/lighthouse.mjs` (versionado).

Para diagnóstico, `LH_PAGES=inicio LH_PROFILES=mobile LH_RUNS=1 npm run lighthouse` roda só uma parte e grava em `lighthouse/diagnostics/`, sem alterar os relatórios oficiais.

## Deploy (Vercel)

O deploy usa o build de demonstração, com os mocks e o tempo real funcionando no navegador; não há backend para publicar.

1. Importe o repositório em vercel.com (framework: Vite). O `vercel.json` já define `buildCommand: npm run build:demo`, `outputDirectory: dist`, o fallback de SPA para `index.html` (sem afetar `mockServiceWorker.js` e os assets) e os cabeçalhos do Service Worker.
2. Em **Settings → Build and Deployment → Node.js Version**, use **22.x** (o projeto exige Node ≥ 22.19).
3. Não é preciso definir variáveis de ambiente: o `.env.demo` versionado já liga os mocks.
4. Depois de publicar, confira:
   - `BASE_URL=https://sua-url.vercel.app npm run check:routes` (acesso direto e refresh de todas as rotas, sem rolagem horizontal);
   - no navegador: DevTools → Application → Service Workers mostra o `mockServiceWorker.js` ativo; no desktop, o ponto verde ao lado do carrinho no cabeçalho indica "Tempo real conectado";
   - um fluxo completo: login, carrinho, pagamento e confirmação.

Netlify (`netlify.toml`) e Cloudflare Pages (`public/_redirects`) também estão configurados: build `npm run build:demo`, saída `dist`.

## Auditoria rápida

```bash
npm ci
npm run typecheck && npm run lint && npm run build && npm run build:demo
npx playwright install chromium && npm run test:e2e
npm run lighthouse
npm run preview & npm run check:routes
npm audit
```

## Documentação

- [ARCHITECTURE.md](./ARCHITECTURE.md): contratos REST, eventos Socket.IO e transporte nos mocks, sessão, carrinho, cache, reconciliação, idempotência, performance, limitações, decisões de UX e desvios do Figma.
- [STATUS.md](./STATUS.md): matriz de requisitos do briefing com status e evidência, e os resultados de cada verificação executada.
- [lighthouse/RESULTS.md](./lighthouse/RESULTS.md): medianas do Lighthouse.
